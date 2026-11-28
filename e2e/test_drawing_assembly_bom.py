"""Insert an assembly BOM as an independent, persistent drawing table."""

import json

from playwright.sync_api import expect

from test_drawing import save_document, sheet, workspace
from test_kernel import create_box, prepare
from test_regression import browser, page


def bom_cells(table):
    return [
        ['\n'.join(''.join(run['text'] for run in p['runs']) for p in cell) for cell in row]
        for row in table['rows']
    ]


def test_assembly_bom_inserts_snapshot_with_drawing_undo_and_reopen(page, tmp_path):
    prepare(page)
    workspace(page)
    insert = page.get_by_role('button', name='Спецификация сборки', exact=True)
    preview = sheet(page).get_by_role('button', name='Спецификация сборки', exact=True)
    expect(insert).to_be_disabled()
    expect(preview).to_have_count(0)

    prepare(page)
    create_box(page)
    model = save_document(page, tmp_path, 'bom-drawing-source.json')
    source = model['exactModel']['bodies'][0]
    source['name'] = 'Вал Ø10'
    source['visible'] = False
    model['assemblyGroups'] = [
        {'id': 'module', 'name': 'Модуль', 'position': [0, 0, 0], 'rotation': [0, 0, 0]},
        {'id': 'drive', 'name': 'Привод', 'position': [0, 0, 0], 'rotation': [0, 0, 0],
         'parentId': 'module'},
    ]
    model['assemblyInstances'] = [
        {'id': f'bom-drawing-{index}', 'name': f'Вал {index}', 'sourceBodyId': source['id'],
         'position': [index * 10, 0, 0], 'rotation': [0, 0, 0],
         **({'parentId': 'drive'} if index else {})}
        for index in range(3)
    ]
    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    file_input = page.get_by_label('Импорт документа JSON', exact=True)

    def open_native(path):
        count = tabs.count()
        file_input.set_input_files(str(path))
        expect(tabs).to_have_count(count + 1, timeout=120000)

    source_file = tmp_path / 'assembly-without-drawing-bom.json'
    source_file.write_text(json.dumps(model, ensure_ascii=False), encoding='utf-8')
    open_native(source_file)
    workspace(page)
    expect(insert).to_be_enabled()
    insert.click()
    expect(preview).to_have_count(1)
    expect(preview).to_contain_text('Вал Ø10')
    expect(preview).to_contain_text('Модуль / Привод × 2')
    expect(preview).to_contain_text('Корень сборки × 1')

    saved = save_document(page, tmp_path, 'assembly-with-drawing-bom.json')
    drawing = saved['drawing']
    active_sheet = next(item for item in drawing['sheets'] if item['id'] == drawing['activeSheetId'])
    (table,) = [entity for entity in active_sheet['entities'] if entity['name'] == 'Спецификация сборки']
    assert table['kind'] == 'table'
    header, row = bom_cells(table)
    assert header == ['Деталь', 'Количество', 'Размещение']
    assert row[:2] == ['Вал Ø10', '3']
    assert 'Модуль / Привод × 2' in row[2]
    assert 'Корень сборки × 1' in row[2]
    assert saved['assemblyInstances'] == model['assemblyInstances']

    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(preview).to_have_count(0)
    page.keyboard.press('Control+y')
    expect(preview).to_have_count(1)

    page.get_by_role('button', name='Сборка', exact=True).click()
    page.locator('[data-assembly-occurrence="bom-drawing-0"]').get_by_role(
        'button', name='Удалить вхождение', exact=True,
    ).click()
    page.get_by_role('dialog', name='Удаление вхождения', exact=True).get_by_role(
        'button', name='Удалить', exact=True,
    ).click()
    workspace(page)
    expect(preview).to_contain_text('Корень сборки × 1')
    changed = save_document(page, tmp_path, 'assembly-changed-after-drawing-bom.json')
    assert len(changed['assemblyInstances']) == 2
    assert changed['drawing'] == drawing

    open_native(tmp_path / 'assembly-with-drawing-bom.json')
    workspace(page)
    expect(preview).to_have_count(1)
    expect(preview).to_contain_text('Вал Ø10')
    expect(preview).to_contain_text('Модуль / Привод × 2')
    assert save_document(page, tmp_path, 'assembly-drawing-bom-reopened.json')['drawing'] == drawing
