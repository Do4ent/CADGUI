"""Review regressions for imported geometry, semantic leaders and font mappings."""
import json
import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_drawing import workspace, sheet, entities, command_dialog, save_document


def import_drawing(page, drawing):
    page.get_by_role('button', name='Импорт чертежа JSON', exact=True).click()
    page.get_by_label('Файл инструментария чертежа', exact=True).set_input_files({
        'name': 'review-drawing.json', 'mimeType': 'application/json',
        'buffer': json.dumps(drawing).encode(),
    })


def line_drawing(page, tmp_path):
    page.get_by_role('button', name='Опорная линия', exact=True).click()
    drawing = save_document(page, tmp_path)['drawing']
    return drawing, drawing['sheets'][0]['entities'][0]


def test_balloon_leader_add_remove_preserves_symbol_number(page, tmp_path):
    workspace(page)
    dialog = command_dialog(page, 'TXT-056')
    dialog.get_by_label('Номер позиции', exact=True).fill('17')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    graphic = entities(page).last.locator('[data-annotation-type="balloon"]')
    expect(graphic).to_contain_text('17')
    branch = command_dialog(page, 'TXT-051')
    branch.get_by_label('Действие ветви', exact=True).select_option('add')
    branch.get_by_label('X', exact=True).fill('10')
    branch.get_by_label('Y', exact=True).fill('10')
    branch.get_by_role('button', name='ОК', exact=True).click()
    expect(graphic).to_contain_text('17')
    added = save_document(page, tmp_path, 'with-leader.json')['drawing']['sheets'][0]['entities'][-1]
    assert added['kind'] == 'symbol'
    assert added['annotation']['number'] == '17'
    assert len(added['leaders']) == 1
    branch = command_dialog(page, 'TXT-051')
    branch.get_by_label('Действие ветви', exact=True).select_option('remove')
    branch.get_by_role('button', name='ОК', exact=True).click()
    expect(graphic).to_contain_text('17')
    removed = save_document(page, tmp_path, 'without-leader.json')['drawing']['sheets'][0]['entities'][-1]
    assert removed['kind'] == 'symbol'
    assert removed['annotation']['number'] == '17'
    assert not removed['leaders']


def test_imported_negative_local_line_can_be_selected_at_its_visible_geometry(page, tmp_path):
    workspace(page)
    drawing, line = line_drawing(page, tmp_path)
    line.update(x=120, y=100)
    line['geometry']['points'] = [[-80, -40], [-20, -10]]
    import_drawing(page, drawing)
    target = sheet(page).locator(f'[data-drawing-id="{line["id"]}"]')
    expect(target).to_have_attribute('aria-pressed', 'false')
    point = sheet(page).evaluate('(svg) => { const p = new DOMPoint(70, 75).matrixTransform(svg.getScreenCTM()); return {x:p.x,y:p.y}; }')
    page.mouse.click(point['x'], point['y'])
    expect(target).to_have_attribute('aria-pressed', 'true')
    page.get_by_role('button', name='Размер линии', exact=True).click()
    expect(entities(page)).to_have_count(2)
    saved = save_document(page, tmp_path, 'negative-line-dimension.json')['drawing']
    dimension = saved['sheets'][0]['entities'][-1]
    assert dimension['annotation']['sourceId'] == line['id']
    assert saved['sheets'][0]['entities'][0]['geometry']['points'] == [[-80, -40], [-20, -10]]


@pytest.mark.parametrize('points', [[], None, [[0, 0], [0, 0]]], ids=['empty', 'omitted', 'zero-length'])
def test_invalid_imported_line_dimension_reports_inline_error_and_ui_recovers(page, tmp_path, points):
    workspace(page)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    drawing, line = line_drawing(page, tmp_path)
    if points is None:
        del line['geometry']['points']
    else:
        line['geometry']['points'] = points
    import_drawing(page, drawing)
    target = sheet(page).locator(f'[data-drawing-id="{line["id"]}"]')
    expect(target).to_have_attribute('aria-pressed', 'false')
    target.locator('[data-drawing-ui="true"]').click()
    page.get_by_role('button', name='Размер линии', exact=True).click()
    error = page.get_by_role('alert')
    expect(error).to_contain_text('ненулевой длины' if points else 'две точки')
    expect(entities(page)).to_have_count(1)
    assert not errors
    page.get_by_role('button', name='Опорная линия', exact=True).click()
    page.get_by_role('button', name='Размер линии', exact=True).click()
    expect(entities(page)).to_have_count(3)
    expect(entities(page).last.locator('[data-annotation-type="dimension"]')).to_contain_text('100')
    assert not errors


@pytest.mark.parametrize('layout', ['horizontal', 'vertical', 'arc'])
def test_imported_rich_run_uses_explicit_font_fallback_in_actual_svg(page, tmp_path, layout):
    workspace(page)
    drawing, entity = line_drawing(page, tmp_path)
    entity['kind'] = 'text'
    del entity['geometry']
    entity['paragraphs'] = [{'runs': [{'text': 'Mapped', 'format': {'fontFamily': 'MissingFont'}}]}]
    drawing['properties']['fontFallback:MissingFont'] = 'DejaVu Sans'
    if layout == 'vertical':
        entity['overrides']['writingMode'] = 'vertical'
    elif layout == 'arc':
        entity['arc'] = {'radius': 30, 'startAngle': 0, 'clockwise': True, 'inside': False}
    import_drawing(page, drawing)
    mapped = entities(page).last.locator('tspan').filter(has_text='Mapped').first
    expect(mapped).to_have_attribute('font-family', 'DejaVu Sans')
    expect(sheet(page)).to_contain_text('Mapped')
