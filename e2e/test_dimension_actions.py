"""Catalog actions change real dimension state while preserving its source geometry."""
from playwright.sync_api import expect
from test_regression import browser, page
from test_drawing import workspace, save_document
from test_drawing_review import import_drawing
from test_dimensions import source_345, editor, line_refs, graphic


def create(page, tmp_path, manual=None):
    workspace(page)
    source = source_345(page, tmp_path)
    dialog = editor(page)
    line_refs(dialog, source, 'aligned')
    if manual:
        dialog.get_by_label('Переопределить текст', exact=True).check()
        dialog.get_by_label('Ручная подпись', exact=True).fill(manual)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(graphic(page)).to_have_attribute('data-dimension-value', '5')
    return source


def action(page, identifier):
    page.locator(f'[data-dimension-command="{identifier}"]').click()


def select_dimension(page):
    text = graphic(page).locator('[data-dimension-text]')
    text.scroll_into_view_if_needed()
    text.click()


def test_restore_catalog_action_keeps_reference_and_measured_value(page, tmp_path):
    source = create(page, tmp_path, 'Ручное значение')
    expect(graphic(page).locator('[data-dimension-text]')).to_contain_text('Ручное значение')
    action(page, 'DIM-068')
    expect(graphic(page).locator('[data-dimension-text]')).not_to_contain_text('Ручное значение')
    expect(graphic(page)).to_have_attribute('data-dimension-value', '5')
    drawing = save_document(page, tmp_path)['drawing']
    definition = drawing['sheets'][0]['entities'][-1]['dimension']
    assert 'manualText' not in definition
    assert definition['refs'][0]['entityId'] == source
    assert drawing['sheets'][0]['entities'][0]['geometry']['points'] == [[0, 0], [3, 4]]


def test_freeze_resume_and_detach_use_explicit_snapshots(page, tmp_path):
    create(page, tmp_path)
    action(page, 'DIM-043')
    drawing = save_document(page, tmp_path)['drawing']
    assert drawing['sheets'][0]['entities'][-1]['dimension']['frozen']['value'] == 5
    drawing['sheets'][0]['entities'][0]['geometry']['points'] = [[0, 0], [6, 8]]
    import_drawing(page, drawing)
    expect(graphic(page)).to_have_attribute('data-dimension-value', '5')
    select_dimension(page)
    action(page, 'DIM-043')
    expect(graphic(page)).to_have_attribute('data-dimension-value', '10')
    action(page, 'DIM-044')
    drawing = save_document(page, tmp_path, 'detached.json')['drawing']
    dimension = drawing['sheets'][0]['entities'][-1]
    assert dimension['dimension']['refs'] == []
    assert dimension['dimension']['frozen']['value'] == 10
    assert 'sourceId' not in dimension['annotation']
    drawing['sheets'][0]['entities'] = [dimension]
    import_drawing(page, drawing)
    expect(graphic(page)).to_have_attribute('data-dimension-value', '10')


def test_named_style_library_and_standard_style_apply_keep_sources(page, tmp_path):
    source = create(page, tmp_path)
    action(page, 'DIM-047')
    dialog = page.get_by_role('dialog', name='Размерные стили', exact=True)
    dialog.get_by_label('Имя размерного стиля', exact=True).fill('Сохранённый размерный стиль')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible()
    action(page, 'DIM-047')
    dialog.get_by_label('Действие со стилем', exact=True).select_option('apply')
    dialog.get_by_label('Именованный размерный стиль', exact=True).select_option('')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible()
    drawing = save_document(page, tmp_path)['drawing']
    assert drawing['dimensionStyles'][0]['name'] == 'Сохранённый размерный стиль'
    definition = drawing['sheets'][0]['entities'][-1]['dimension']
    assert definition['style']['id'] == 'dim-default'
    assert definition['refs'][0]['entityId'] == source
