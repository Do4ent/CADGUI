"""Real sheet entities: confirmation, history, persistence and document isolation."""
import json
import re

from playwright.sync_api import expect
from test_regression import browser, page


EDITOR = 'Редактор текста чертежа'


def sheet(page):
    return page.locator('svg[data-drawing-sheet="true"]')


def entities(page):
    return sheet(page).locator('[data-drawing-id]')


def workspace(page):
    page.keyboard.press('Alt+4')
    expect(sheet(page)).to_be_visible()


def command(page, identifier):
    page.get_by_role('button', name=re.compile(re.escape(identifier))).first.click()


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
        page.locator('body').click(position={'x': 1, 'y': 1})
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
