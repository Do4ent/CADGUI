"""Real sheet entities: confirmation, history, persistence and document isolation."""
import json
import re
from pathlib import Path

from playwright.sync_api import expect
from test_regression import browser, page


EDITOR = 'Редактор текста чертежа'
CATALOG = json.loads((Path(__file__).resolve().parents[1] / 'docs' / 'DRAWING_TEXT_TOOLKIT.json').read_text())
COMMAND_LABELS = {feature['id']: feature['label'] for group in CATALOG['groups'] for feature in group['features']}


def sheet(page):
    return page.locator('svg[data-drawing-sheet="true"]')


def entities(page):
    return sheet(page).locator('[data-drawing-id]')


def workspace(page):
    page.keyboard.press('Alt+4')
    expect(sheet(page)).to_be_visible()


def command(page, identifier):
    page.locator(f'[data-drawing-command="{identifier}"]').click()


def command_dialog(page, identifier):
    command(page, identifier)
    dialog = page.get_by_role('dialog', name=COMMAND_LABELS[identifier], exact=True)
    expect(dialog).to_be_visible()
    return dialog


def text_editor(page, text):
    command(page, 'TXT-002')
    dialog = page.get_by_role('dialog', name=EDITOR, exact=True)
    expect(dialog).to_be_visible()
    dialog.get_by_label('Абзац 1', exact=True).fill(text)
    return dialog


def create_text(page, text):
    dialog = text_editor(page, text)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible()


def save_document(page, tmp_path, name='drawing.json'):
    with page.expect_download() as download:
        page.get_by_title('Сохранить JSON', exact=True).click()
    target = tmp_path / name
    download.value.save_as(target)
    return json.loads(target.read_text())


def test_drawing_creation_cancel_edit_and_one_step_history(page):
    workspace(page)
    count = entities(page).count()
    dialog = text_editor(page, 'Отменённая надпись')
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    expect(entities(page)).to_have_count(count)
    create_text(page, 'Редуктор Ø25 ±0,1\nВторая строка')
    expect(entities(page)).to_have_count(count + 1)
    expect(sheet(page)).to_contain_text('Редуктор Ø25 ±0,1')
    created = entities(page).last
    created.dblclick()
    dialog = page.get_by_role('dialog', name=EDITOR, exact=True)
    dialog.get_by_label('Абзац 1', exact=True).fill('Несохранённая правка')
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    expect(sheet(page)).to_contain_text('Редуктор Ø25 ±0,1')
    expect(sheet(page)).not_to_contain_text('Несохранённая правка')
    created.dblclick()
    dialog = page.get_by_role('dialog', name=EDITOR, exact=True)
    dialog.get_by_label('Абзац 1', exact=True).fill('Новая редакция')
    dialog.get_by_label('Абзац 1', exact=True).press('Control+Enter')
    expect(sheet(page)).to_contain_text('Новая редакция')
    for shortcut, expected_count, text in [
        ('Control+z', count + 1, 'Редуктор Ø25 ±0,1'),
        ('Control+z', count, None),
        ('Control+y', count + 1, 'Редуктор Ø25 ±0,1'),
        ('Control+y', count + 1, 'Новая редакция'),
    ]:
        page.evaluate('document.activeElement?.blur()')
        page.keyboard.press(shortcut)
        expect(entities(page)).to_have_count(expected_count)
        if text:
            expect(sheet(page)).to_contain_text(text)


def test_drawing_text_isolated_between_document_tabs_and_persists(page, tmp_path):
    workspace(page)
    create_text(page, 'Текст первого документа')
    saved = save_document(page, tmp_path)
    assert saved['schemaVersion'] == 2
    assert 'drawing' in saved
    page.get_by_title('Новый документ', exact=True).click()
    expect(entities(page)).to_have_count(0)
    create_text(page, 'Другой документ')
    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    tabs.first.click()
    expect(sheet(page)).to_contain_text('Текст первого документа')
    expect(sheet(page)).not_to_contain_text('Другой документ')
    page.reload(wait_until='domcontentloaded')
    workspace(page)
    expect(sheet(page)).to_contain_text('Текст первого документа')
    tabs.nth(1).click()
    expect(sheet(page)).to_contain_text('Другой документ')
    expect(sheet(page)).not_to_contain_text('Текст первого документа')


def test_drawing_format_mask_and_position_are_persisted(page, tmp_path):
    workspace(page)
    dialog = text_editor(page, 'Проверка оформления')
    for label, value in [('X', '42'), ('Y', '67'), ('Поворот', '30'), ('Высота текста', '5'), ('Ширина контейнера', '80')]:
        dialog.get_by_label(label, exact=True).fill(value)
    dialog.get_by_label('Жирный', exact=True).check()
    dialog.get_by_label('Маска фона', exact=True).check()
    dialog.get_by_role('button', name='ОК', exact=True).click()
    saved = save_document(page, tmp_path)
    drawing = saved['drawing']
    entity = drawing['sheets'][0]['entities'][-1]
    assert (entity['x'], entity['y'], entity['rotation'], entity['width']) == (42, 67, 30, 80)
    style = {**next(s for s in drawing['styles'] if s['id'] == entity['styleId']), **entity['overrides']}
    assert style['bold'] is True
    assert style['mask'] is True
    assert style['height'] == 5
    assert entities(page).last.locator('rect').count() > 0


def test_all_twelve_groups_expose_the_102_catalog_commands(page):
    workspace(page)
    panel = page.get_by_role('region', name='Инструменты текста чертежа')
    expect(panel.locator('[data-drawing-group]')).to_have_count(12)
    expect(panel.locator('[data-drawing-command]')).to_have_count(102)
    actual = panel.locator('[data-drawing-command]').evaluate_all('(nodes) => nodes.map(n => n.dataset.drawingCommand)')
    assert len(set(actual)) == 102
    assert set(actual) == set(COMMAND_LABELS)
    for group in CATALOG['groups']:
        section = panel.locator(f'[data-drawing-group="{group["id"]}"]')
        expect(section).to_contain_text(group['label'])
        for feature in group['features']:
            button = section.locator(f'[data-drawing-command="{feature["id"]}"]')
            expect(button).to_have_accessible_name(re.compile(re.escape(feature['id'])))


def test_leader_table_title_fields_and_technical_requirements_are_real_entities(page, tmp_path):
    workspace(page)
    command(page, 'TXT-005')
    editor = page.get_by_role('dialog', name=EDITOR, exact=True)
    editor.get_by_label('Абзац 1', exact=True).fill('Связанная выноска')
    editor.get_by_role('button', name='ОК', exact=True).click()
    expect(sheet(page)).to_contain_text('Связанная выноска')
    table = command_dialog(page, 'TXT-007')
    table.get_by_label('Строки', exact=True).fill('2')
    table.get_by_label('Столбцы', exact=True).fill('2')
    table.get_by_label('Данные таблицы TSV', exact=True).fill('Деталь\tКоличество\nБолт\t4')
    table.get_by_role('button', name='ОК', exact=True).click()
    expect(sheet(page)).to_contain_text('Болт')
    title = command_dialog(page, 'TXT-008')
    title.get_by_label('Название', exact=True).fill('Редуктор учебный')
    title.get_by_label('Обозначение', exact=True).fill('БК.001')
    title.get_by_label('Автор', exact=True).fill('Инженер')
    title.get_by_role('button', name='ОК', exact=True).click()
    expect(sheet(page)).to_contain_text('Редуктор учебный')
    requirements = command_dialog(page, 'TXT-067')
    requirements.get_by_label('Технические требования', exact=True).fill('Острые кромки притупить.\nПокрытие защитное.')
    requirements.get_by_role('button', name='ОК', exact=True).click()
    expect(sheet(page)).to_contain_text('Острые кромки притупить.')
    drawing = save_document(page, tmp_path)['drawing']
    content = [entity for current_sheet in drawing['sheets'] for entity in current_sheet['entities']]
    leader = next(entity for entity in content if entity['kind'] == 'leader')
    assert leader['leaders'] and len(leader['leaders'][0]['points']) >= 2
    table_entity = next(entity for entity in content if entity['kind'] == 'table')
    assert len(table_entity['rows']) == 2
    assert all(len(row) == 2 for row in table_entity['rows'])
    assert any(entity.get('technical') is True for entity in content)


def test_find_replace_changes_real_text_and_is_one_undo_step(page):
    workspace(page)
    create_text(page, 'Контроль alpha alpha')
    dialog = command_dialog(page, 'TXT-075')
    dialog.get_by_label('Найти', exact=True).fill('alpha')
    dialog.get_by_label('Заменить', exact=True).fill('beta')
    dialog.get_by_label('Область', exact=True).select_option('document')
    dialog.get_by_label('Заменять совпадения', exact=True).check()
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(sheet(page)).to_contain_text('Контроль beta beta')
    expect(sheet(page)).not_to_contain_text('alpha')
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(sheet(page)).to_contain_text('Контроль alpha alpha')
    page.keyboard.press('Control+y')
    expect(sheet(page)).to_contain_text('Контроль beta beta')


def test_svg_dxf_exports_and_invalid_json_diagnostics_preserve_drawing(page, tmp_path):
    workspace(page)
    create_text(page, 'Экспортируемый текст Ø30')
    before = save_document(page, tmp_path, 'before.json')
    with page.expect_download() as svg_download:
        page.get_by_role('button', name='Экспорт SVG', exact=True).click()
    svg_target = tmp_path / 'sheet.svg'
    svg_download.value.save_as(svg_target)
    svg = svg_target.read_text()
    assert '<svg' in svg and '<text' in svg
    assert 'Экспортируемый текст' in svg
    assert '<script' not in svg.lower()
    with page.expect_download() as dxf_download:
        page.get_by_role('button', name='Экспорт DXF', exact=True).click()
    dxf_target = tmp_path / 'sheet.dxf'
    dxf_download.value.save_as(dxf_target)
    dxf = dxf_target.read_text()
    assert 'SECTION' in dxf and 'ENTITIES' in dxf and 'EOF' in dxf
    assert 'TEXT' in dxf or 'MTEXT' in dxf
    invalid = json.loads(json.dumps(before))
    invalid['drawing']['sheets'][0]['entities'][0]['x'] = 'invalid-coordinate'
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({'name': 'broken-drawing.json', 'mimeType': 'application/json', 'buffer': json.dumps(invalid).encode()})
    expect(page.get_by_role('alert')).to_be_visible()
    after = save_document(page, tmp_path, 'after.json')
    assert after['drawing'] == before['drawing']
    assert after['items'] == before['items']
    expect(page.get_by_role('region', name='Проверка чертежа')).to_be_visible()
