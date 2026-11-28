"""Assembly quantities and CSV derive from source identity and nested placements."""

import csv
import json

from playwright.sync_api import expect

from test_drawing import save_document
from test_kernel import create_box, prepare
from test_regression import browser, page


def test_assembly_bom_quantities_nested_paths_and_download(page, tmp_path):
    prepare(page)
    page.get_by_role('button', name='Сборка', exact=True).click()
    panel = page.get_by_role('region', name='Вхождения деталей', exact=True)
    open_bom = panel.get_by_role('button', name='Спецификация сборки', exact=True)
    bom = page.get_by_role('dialog', name='Спецификация сборки', exact=True)
    download_csv = bom.get_by_role('button', name='Скачать CSV', exact=True)
    close = bom.get_by_role('button', name='Закрыть', exact=True)
    table = bom.get_by_role('table', name='Детали сборки', exact=True)

    open_bom.click()
    expect(bom).to_be_visible()
    expect(table.get_by_role('cell', name='Вал "А", Ø10', exact=True)).to_have_count(0)
    expect(download_csv).to_be_disabled()
    close.click()
    expect(bom).not_to_be_visible()

    create_box(page)
    document = save_document(page, tmp_path, 'bom-source.json')
    name = 'Вал "А", Ø10'
    source = document['exactModel']['bodies'][0]
    document['exactModel']['bodies'] = [
        {**source, 'id': 'primary-shaft', 'name': name, 'visible': False},
        {**source, 'id': 'secondary-shaft', 'name': name, 'visible': False},
    ]
    document['assemblyGroups'] = [
        {'id': 'module', 'name': 'Модуль', 'position': [0, 0, 0], 'rotation': [0, 0, 0]},
        {'id': 'drive', 'name': 'Привод', 'position': [0, 0, 0], 'rotation': [0, 0, 0],
         'parentId': 'module'},
    ]
    placements = [
        ('shaft-root', 'primary-shaft', None),
        ('shaft-module', 'primary-shaft', 'module'),
        ('shaft-drive', 'primary-shaft', 'drive'),
        ('other-drive', 'secondary-shaft', 'drive'),
    ]
    document['assemblyInstances'] = [
        {'id': instance, 'name': instance, 'sourceBodyId': body,
         'position': [10 * index, 0, 0], 'rotation': [0, 0, 0],
         **({'parentId': parent} if parent else {})}
        for index, (instance, body, parent) in enumerate(placements)
    ]
    dev_file = tmp_path / 'bom-nested.json'
    dev_file.write_text(json.dumps(document, ensure_ascii=False), encoding='utf-8')
    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    count = tabs.count()
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files(str(dev_file))
    expect(tabs).to_have_count(count + 1, timeout=120000)

    open_bom.click()
    expect(table.get_by_role('columnheader', name='Вхождения', exact=True)).to_be_visible()
    same_name_rows = table.get_by_role('row').filter(has_text=name)
    expect(same_name_rows).to_have_count(2)
    primary = same_name_rows.filter(has=page.get_by_role('cell', name='3', exact=True))
    expect(primary).to_contain_text('Корень сборки')
    expect(primary).to_contain_text('Модуль / Привод')
    secondary = same_name_rows.filter(has=page.get_by_role('cell', name='1', exact=True))
    expect(secondary).to_contain_text('Модуль / Привод')
    expect(secondary).not_to_contain_text('Корень сборки')

    with page.expect_download() as download:
        download_csv.click()
    assert download.value.suggested_filename == 'assembly-bom.csv'
    csv_file = tmp_path / 'assembly-bom.csv'
    download.value.save_as(csv_file)
    with csv_file.open(encoding='utf-8-sig', newline='') as stream:
        records = list(csv.DictReader(stream))
    assert len(records) == 2
    by_source = {record['Идентификатор источника']: record for record in records}
    assert set(by_source) == {'primary-shaft', 'secondary-shaft'}
    assert {record['Деталь'] for record in records} == {name}
    assert by_source['primary-shaft']['Количество'] == '3'
    assert by_source['secondary-shaft']['Количество'] == '1'
    assert 'Корень сборки' in by_source['primary-shaft']['Размещения']
    assert 'Модуль / Привод' in by_source['primary-shaft']['Размещения']

    close.click()
    row = page.locator('[data-assembly-occurrence="shaft-root"]')
    row.get_by_role('button', name='Удалить вхождение', exact=True).click()
    page.get_by_role('dialog', name='Удаление вхождения', exact=True).get_by_role(
        'button', name='Удалить', exact=True,
    ).click()
    expect(row).to_have_count(0)
    open_bom.click()
    expect(same_name_rows.filter(has=page.get_by_role('cell', name='2', exact=True))).to_have_count(1)
    expect(table).not_to_contain_text('Корень сборки')
    close.click()

    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(row).to_have_count(1)
    open_bom.click()
    expect(primary).to_contain_text('Корень сборки')
