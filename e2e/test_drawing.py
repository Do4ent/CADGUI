"""Real sheet entities: confirmation, history, persistence and document isolation."""
import json
import re
import base64
import shutil
import subprocess
import xml.etree.ElementTree as ET
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
    assert saved['schemaVersion'] == 8
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
    search = panel.get_by_label('Поиск текстовых команд', exact=True)
    search.fill('TXT-075')
    expect(panel.locator('[data-drawing-command]')).to_have_count(1)
    expect(panel.locator('[data-drawing-command="TXT-075"]')).to_be_visible()
    search.fill('')
    expect(panel.locator('[data-drawing-command]')).to_have_count(102)


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
    dialog.get_by_label('Заменять совпадения', exact=True).check()
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
    extracted = ''.join(ET.fromstring(svg).itertext())
    assert 'Экспортируемый текст' in extracted
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


def test_vector_pdf_embeds_searchable_cyrillic_text(page, tmp_path):
    workspace(page)
    create_text(page, 'Редуктор TEST 123')
    with page.expect_download(timeout=60000) as downloaded:
        page.get_by_role('button', name='Экспорт PDF', exact=True).click()
    target = tmp_path / 'drawing.pdf'
    downloaded.value.save_as(target)
    data = target.read_bytes()
    assert data.startswith(b'%PDF-')
    assert b'/ToUnicode' in data
    if shutil.which('pdftotext'):
        result = subprocess.run(['pdftotext', str(target), '-'], capture_output=True, text=True, check=True)
        assert 'Редуктор' in result.stdout
        assert 'TEST 123' in result.stdout


def test_real_ocr_recognizes_uploaded_pixels_before_reviewed_insertion(page):
    workspace(page)
    png = page.evaluate('''() => {
      const canvas = document.createElement('canvas');
      canvas.width = 720; canvas.height = 200;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 720, 200);
      ctx.fillStyle = 'black'; ctx.font = '80px Arial';
      ctx.fillText('TEST 123', 40, 125);
      return canvas.toDataURL('image/png').split(',')[1];
    }''')
    before = entities(page).count()
    command(page, 'TXT-092')
    page.get_by_label('Файл инструментария чертежа', exact=True).set_input_files({'name': 'ocr-pixels.png', 'mimeType': 'image/png', 'buffer': base64.b64decode(png)})
    dialog = page.get_by_role('dialog', name='Распознавание и проверка текста', exact=True)
    dialog.get_by_label('Язык OCR', exact=True).select_option('eng')
    dialog.get_by_role('button', name='Распознать', exact=True).click()
    reviewed = dialog.get_by_label('Проверенный текст OCR', exact=True)
    expect(reviewed).to_have_value(re.compile(r'TEST\s+123'), timeout=90000)
    expect(entities(page)).to_have_count(before)
    dialog.get_by_role('button', name='Вставить проверенный текст', exact=True).click()
    expect(entities(page)).to_have_count(before + 1)
    expect(sheet(page)).to_contain_text('TEST')


def test_real_font_outlines_export_paths_without_text_nodes(page, tmp_path):
    workspace(page)
    create_text(page, 'Контуры TEST')
    command(page, 'TXT-090')
    dialog = page.get_by_role('dialog', name='Текст в контуры', exact=True)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    font = Path(__file__).resolve().parents[1] / 'public' / 'fonts' / 'DejaVuSans.ttf'
    assert font.is_file(), 'The bundled outline font must be available offline'
    with page.expect_download(timeout=60000) as downloaded:
        page.get_by_label('Файл инструментария чертежа', exact=True).set_input_files(str(font))
    target = tmp_path / 'outlines.svg'
    downloaded.value.save_as(target)
    svg = target.read_text()
    assert '<svg' in svg and '<path' in svg
    assert '<text' not in svg
    expect(sheet(page)).to_contain_text('Контуры TEST')


def test_native_vertical_and_rtl_modes_change_actual_svg_attributes(page):
    workspace(page)
    create_text(page, 'Направление ABC')
    command(page, 'TXT-017')
    dialog = page.get_by_role('dialog', name='Направление текста', exact=True)
    dialog.get_by_label('Направление текста', exact=True).select_option('vertical')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    text = entities(page).last.locator('text').first
    assert text.evaluate('(el) => getComputedStyle(el).writingMode') in ['vertical-rl', 'vertical-lr']
    command(page, 'TXT-102')
    dialog = page.get_by_role('dialog', name='Направление текста', exact=True)
    dialog.get_by_label('Направление текста', exact=True).select_option('rtl')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    assert text.evaluate('(el) => getComputedStyle(el).direction') == 'rtl'


def test_dictionary_spellcheck_reports_an_actual_unknown_word(page):
    workspace(page)
    create_text(page, 'mispelingxyz')
    command(page, 'TXT-078')
    dialog = page.get_by_role('dialog', name='Проверка орфографии', exact=True)
    dialog.get_by_label('Язык орфографии', exact=True).select_option('en')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    report = page.get_by_role('region', name='Проверка чертежа')
    expect(report).to_contain_text('mispelingxyz', timeout=60000)
    expect(sheet(page)).to_contain_text('mispelingxyz')


def test_selection_sensitive_commands_are_disabled_until_a_real_entity_exists(page):
    workspace(page)
    for identifier in ['TXT-009', 'TXT-084', 'TXT-097', 'TXT-102']:
        expect(page.locator(f'[data-drawing-command="{identifier}"]')).to_be_disabled()
    create_text(page, 'Выбранный объект')
    for identifier in ['TXT-009', 'TXT-084', 'TXT-097', 'TXT-102']:
        expect(page.locator(f'[data-drawing-command="{identifier}"]')).to_be_enabled()


def test_document_field_creates_structured_text_without_existing_selection(page, tmp_path):
    workspace(page)
    expect(entities(page)).to_have_count(0)
    dialog = command_dialog(page, 'TXT-059')
    dialog.get_by_label('Источник поля', exact=True).select_option('document')
    dialog.get_by_label('Свойство поля', exact=True).select_option('name')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(entities(page)).to_have_count(1)
    saved = save_document(page, tmp_path)
    expect(sheet(page)).to_contain_text(saved['name'])
    entity = saved['drawing']['sheets'][0]['entities'][0]
    fields = [run['field'] for paragraph in entity['paragraphs'] for run in paragraph['runs'] if 'field' in run]
    assert len(fields) == 1
    assert fields[0]['kind'] == 'document'
    assert fields[0]['key'] == 'name'


def test_balloon_renders_its_number_without_internal_mode_metadata(page, tmp_path):
    workspace(page)
    dialog = command_dialog(page, 'TXT-056')
    dialog.get_by_label('Номер позиции', exact=True).fill('7')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    graphic = entities(page).last.locator('[data-annotation-type="balloon"]')
    expect(graphic).to_contain_text('7')
    expect(graphic).not_to_contain_text('manual')
    saved = save_document(page, tmp_path)
    annotation = saved['drawing']['sheets'][0]['entities'][-1]['annotation']
    assert annotation['number'] == '7'
    assert annotation['fields']['mode'] == 'manual'


def test_plain_clipboard_paste_preserves_literal_text_without_html_execution(page):
    workspace(page)
    create_text(page, 'Заменяемый текст')
    page.context.grant_permissions(['clipboard-read', 'clipboard-write'])
    payload = '<script>window.drawingPasteExecuted=true</script>\nКириллица Ø25'
    page.evaluate('(text) => navigator.clipboard.writeText(text)', payload)
    dialog = command_dialog(page, 'TXT-084')
    field = dialog.get_by_label('Текст', exact=True)
    field.focus()
    field.press('Control+a')
    field.press('Control+v')
    expect(field).to_have_value(payload)
    dialog.get_by_label('Сбросить оформление', exact=True).check()
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(sheet(page)).to_contain_text('<script>window.drawingPasteExecuted=true</script>')
    expect(sheet(page)).to_contain_text('Кириллица Ø25')
    assert page.evaluate('window.drawingPasteExecuted === undefined')


def test_line_dimension_prefix_suffix_preserve_actual_source_measurement(page, tmp_path):
    workspace(page)
    page.get_by_role('button', name='Опорная линия', exact=True).click()
    source_id = entities(page).last.get_attribute('data-drawing-id')
    page.get_by_role('button', name='Размер линии', exact=True).click()
    expect(entities(page)).to_have_count(2)
    dialog = command_dialog(page, 'TXT-047')
    dialog.get_by_label('Префикс', exact=True).fill('Ø')
    dialog.get_by_label('Суффикс', exact=True).fill(' ±0.1')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    graphic = entities(page).last.locator('[data-annotation-type="dimension"]')
    expect(graphic).to_contain_text('100')
    expect(graphic).to_contain_text('Ø')
    expect(graphic).to_contain_text('±0.1')
    expect(graphic).not_to_contain_text('manual')
    saved = save_document(page, tmp_path)
    dimension = saved['drawing']['sheets'][0]['entities'][-1]['annotation']
    assert dimension['type'] == 'dimension'
    assert dimension['sourceId'] == source_id
    assert dimension['prefix'] == 'Ø'
    assert dimension['suffix'] == ' ±0.1'
