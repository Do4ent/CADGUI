"""Model notes persist independently of Drawing and participate in model history."""
import json

import pytest
from playwright.sync_api import expect
import re
from test_regression import browser, page, items
from test_drawing import save_document


@pytest.fixture(autouse=True)
def single_model_view(page):
    page.locator('.multi-view-tools').get_by_role('button', name='1', exact=True).click()


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
    # Put the anchor and label above opaque demo solids: occluded notes are
    # intentionally absent from the scene rather than rendered through parts.
    for label, value in [('X опоры', '0'), ('Y опоры', '3'), ('Z опоры', '0'),
                         ('Смещение подписи X', '0.5'), ('Смещение подписи Y', '0.5'), ('Смещение подписи Z', '0')]:
        dialog.get_by_label(label, exact=True).fill(value)
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
    assert document['schemaVersion'] == 4
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
    expect(page.locator('.app')).to_have_class(re.compile(r'\b' + theme + r'\b'))
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
    expect(labels(page)).to_have_attribute('data-model-annotation-orientation', orientation)
    rendered_position = [float(value) for value in labels(page).get_attribute('data-model-annotation-position').split()]
    assert rendered_position == pytest.approx([0.5, 3.5, 0])


def test_component_note_tracks_motion_reports_missing_source_and_rebinds(page, tmp_path):
    component = 'gear1'
    original = next(item for item in items(page) if item['id'] == component)
    create_note(page, 'Привязанная заметка', 'component', component)
    annotation_id = labels(page).get_attribute('data-model-annotation-id')
    before_position = [float(value) for value in labels(page).get_attribute('data-model-annotation-position').split()]
    page.locator(f'[role="treeitem"][data-tree-id="{component}"]').click()
    page.locator('[data-property-editor] input[type="number"]').first.fill(str(original['pos'][0] + 1))
    page.wait_for_function('''({id, x}) => {
      const node = document.querySelector(`[data-model-annotation-id="${id}"]`);
      return node && Math.abs(Number(node.dataset.modelAnnotationPosition.split(' ')[0]) - x) < 1e-9;
    }''', arg={'id': annotation_id, 'x': before_position[0] + 1})
    moved = [float(value) for value in labels(page).get_attribute('data-model-annotation-position').split()]
    assert moved == pytest.approx([before_position[0] + 1, *before_position[1:]])
    search = page.locator('.command-search input')
    search.fill('Удалить')
    search.press('Enter')
    page.wait_for_function('(id) => !JSON.parse(localStorage.getItem("bendcore-items")).some(item => item.id === id)', arg=component)
    expect(labels(page)).to_have_count(0)
    row = panel(page).locator(f'[data-model-annotation-row="{annotation_id}"]')
    expect(row.locator('[data-model-annotation-status]')).to_have_attribute('data-model-annotation-status', 'missing')
    expect(row).to_contain_text('Источник отсутствует')
    missing = annotations(save_document(page, tmp_path, 'missing-source.json'))
    assert missing[0]['id'] == annotation_id
    assert missing[0]['anchor']['componentId'] == component
    dialog = edit_note(page, 'Привязанная заметка')
    dialog.get_by_label('Компонент', exact=True).select_option('gear2')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(labels(page)).to_have_count(1)
    expect(row.locator('[data-model-annotation-status]')).to_have_attribute('data-model-annotation-status', 'visible')
    rebound = annotations(save_document(page, tmp_path, 'rebound.json'))
    assert rebound[0]['id'] == annotation_id
    assert rebound[0]['text'] == 'Привязанная заметка'
    assert rebound[0]['anchor']['componentId'] == 'gear2'
    assert rebound[0]['anchor']['point'] == [0, 3, 0]


def test_delete_selected_note_leaves_components_unchanged_and_undo_restores_note(page, tmp_path):
    original_items = items(page)
    create_note(page, 'Удалить только заметку')
    labels(page).click()
    page.keyboard.press('Delete')
    expect(labels(page)).to_have_count(0)
    assert items(page) == original_items
    saved = save_document(page, tmp_path)
    assert annotations(saved) == []
    assert saved['items'] == original_items
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(labels(page)).to_contain_text(['Удалить только заметку'])
    assert items(page) == original_items


def test_apply_invalid_draft_and_cancel_preserve_last_applied_note(page, tmp_path):
    dialog = open_note(page, 'Сохранено через Apply')
    dialog.get_by_role('button', name='Применить', exact=True).click()
    expect(dialog).to_be_visible()
    expect(labels(page)).to_contain_text(['Сохранено через Apply'])
    dialog.get_by_label('Текст заметки', exact=True).fill('  ')
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    expect(dialog.get_by_role('button', name='Применить', exact=True)).to_be_disabled()
    dialog.get_by_label('Текст заметки', exact=True).fill('Несохранённый черновик')
    dialog.get_by_label('Размер шрифта', exact=True).fill('0')
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    note = annotations(save_document(page, tmp_path))[0]
    assert note['text'] == 'Сохранено через Apply'
    assert note['fontSize'] == 0.4
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(labels(page)).to_have_count(0)


def test_component_overflow_is_reported_without_changing_document(page, tmp_path):
    create_note(page, 'Проверка опоры', 'component', 'gear1')
    doc = save_document(page, tmp_path, 'source.json')
    note = annotations(doc)[0]
    note['visible'] = False
    note['anchor']['point'] = [1e308, 0, 0]
    note['offset'] = [0, 0, 0]
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({
        'name': 'finite-anchor.json', 'mimeType': 'application/json',
        'buffer': json.dumps(doc).encode(),
    })
    page.wait_for_function('''() => {
      const w=JSON.parse(localStorage.getItem('bendcore-documents-v1'));
      return w.tabs.find(t=>t.document.id===w.activeId)?.document.modelAnnotations.annotations[0]?.anchor.point[0]===1e308;
    }''')
    before = save_document(page, tmp_path, 'before-overflow.json')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.locator('[role="treeitem"][data-tree-id="gear1"]').click()
    page.locator('[data-property-editor] input[type="number"]').first.fill('1e308')
    expect(page.get_by_role('alert').filter(has_text='Изменение не применено')).to_be_visible()
    after = save_document(page, tmp_path, 'after-overflow.json')
    assert after == before
    assert not errors
