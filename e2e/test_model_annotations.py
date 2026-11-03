"""Model notes persist independently of Drawing and participate in model history."""
import json

import pytest
from playwright.sync_api import expect
from test_regression import browser, page, items
from test_drawing import save_document


def panel(page):
    return page.get_by_role('region', name='Аннотации модели', exact=True)


def labels(page):
    return page.locator('[data-model-annotation-id]')


def open_note(page, text, mode='world', component='gear1'):
    panel(page).get_by_role('button', name='Добавить 3D-заметку', exact=True).click()
    dialog = page.get_by_role('dialog', name='3D-заметка', exact=True)
    dialog.get_by_label('Текст заметки', exact=True).fill(text)
    dialog.get_by_label('Опора', exact=True).select_option(mode)
    if mode == 'component':
        dialog.get_by_label('Компонент', exact=True).select_option(component)
    return dialog


def create_note(page, text, mode='world', component='gear1'):
    dialog = open_note(page, text, mode, component)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible()
    expect(labels(page).filter(has_text=text)).to_have_count(1)


def edit_note(page, text):
    panel(page).locator('[data-model-annotation-row]').filter(has_text=text).click()
    panel(page).get_by_role('button', name='Редактировать заметку', exact=True).click()
    dialog = page.get_by_role('dialog', name='3D-заметка', exact=True)
    expect(dialog).to_be_visible()
    return dialog


def annotations(document):
    assert document['schemaVersion'] == 3
    assert document['modelAnnotations']['version'] == 1
    return document['modelAnnotations']['annotations']


def test_model_note_cancel_edit_and_each_history_shortcut_is_one_transaction(page, tmp_path):
    before_items = items(page)
    dialog = open_note(page, 'Отменённая модельная заметка')
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    expect(labels(page)).to_have_count(0)
    create_note(page, 'Первая 3D-заметка Ø25')
    dialog = edit_note(page, 'Первая 3D-заметка Ø25')
    dialog.get_by_label('Текст заметки', exact=True).fill('Отменённая правка')
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    expect(labels(page)).to_contain_text(['Первая 3D-заметка Ø25'])
    dialog = edit_note(page, 'Первая 3D-заметка Ø25')
    dialog.get_by_label('Текст заметки', exact=True).fill('Изменённая 3D-заметка')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(labels(page)).to_contain_text(['Изменённая 3D-заметка'])
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(labels(page)).to_contain_text(['Первая 3D-заметка Ø25'])
    page.keyboard.press('Control+z')
    expect(labels(page)).to_have_count(0)
    page.keyboard.press('Control+y')
    expect(labels(page)).to_contain_text(['Первая 3D-заметка Ø25'])
    page.keyboard.press('Control+y')
    expect(labels(page)).to_contain_text(['Изменённая 3D-заметка'])
    saved = save_document(page, tmp_path)
    assert annotations(saved)[0]['text'] == 'Изменённая 3D-заметка'
    assert saved['items'] == before_items
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    expect(labels(page)).to_contain_text(['Изменённая 3D-заметка'])


def test_model_notes_remain_isolated_between_document_tabs_and_reload(page, tmp_path):
    create_note(page, 'Заметка документа A')
    first = save_document(page, tmp_path, 'document-a.json')
    page.get_by_title('Новый документ', exact=True).click()
    expect(labels(page)).to_have_count(0)
    create_note(page, 'Заметка документа B')
    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    tabs.first.click()
    expect(labels(page)).to_contain_text(['Заметка документа A'])
    current = save_document(page, tmp_path, 'document-a-after.json')
    assert annotations(current) == annotations(first)
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    expect(labels(page)).to_contain_text(['Заметка документа A'])
    tabs.nth(1).click()
    expect(labels(page)).to_contain_text(['Заметка документа B'])


def test_invalid_model_annotation_import_preserves_active_document(page, tmp_path):
    create_note(page, 'Сохранить исходную заметку')
    before = save_document(page, tmp_path, 'before.json')
    invalid = json.loads(json.dumps(before))
    invalid['modelAnnotations']['annotations'][0]['offset'] = [0, 'invalid', 0]
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({
        'name': 'invalid-model-note.json', 'mimeType': 'application/json',
        'buffer': json.dumps(invalid).encode(),
    })
    expect(page.get_by_role('alert')).to_be_visible()
    expect(labels(page)).to_contain_text(['Сохранить исходную заметку'])
    after = save_document(page, tmp_path, 'after.json')
    assert after == before


@pytest.mark.parametrize('theme', ['light', 'dark'])
@pytest.mark.parametrize('orientation', ['screen', 'XY', 'XZ', 'YZ'])
def test_note_plane_orientation_and_square_editor_persist_in_both_themes(page, tmp_path, theme, orientation):
    page.evaluate('(theme) => localStorage.setItem("bendcore-theme", theme)', theme)
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    dialog = open_note(page, 'Плоскость заметки ' + orientation)
    dialog.get_by_label('Ориентация', exact=True).select_option(orientation)
    dialog.get_by_label('Выноска', exact=True).check()
    dialog.get_by_label('Смещение подписи X', exact=True).fill('0.5')
    assert dialog.evaluate('(node) => getComputedStyle(node).borderRadius') == '0px'
    assert dialog.locator('button,input,select,textarea').evaluate_all('(nodes) => nodes.every(node => getComputedStyle(node).borderRadius === "0px")')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    saved = save_document(page, tmp_path)
    note = annotations(saved)[0]
    assert note['orientation'] == orientation
    assert note['leader'] is True
    assert note['offset'][0] == 0.5
    assert note['anchor']['kind'] == 'world'
    expect(labels(page)).to_contain_text(['Плоскость заметки ' + orientation])
