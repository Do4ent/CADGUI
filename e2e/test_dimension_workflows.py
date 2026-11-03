"""Circular dimensions and geometry-referenced dimension group workflows."""
import json
import math

import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_drawing import workspace, sheet, entities, save_document
from test_drawing_review import import_drawing, line_drawing


def toolbar(page, name):
    return page.locator('.drawing-toolbar').get_by_role('button', name=name, exact=True)


def dimension_graphics(page):
    return sheet(page).locator('[data-dimension-kind]')


@pytest.mark.parametrize('source,kind,value', [
    ('Окружность', 'radius', 20),
    ('Окружность', 'diameter', 40),
    ('Дуга', 'arc-length', math.pi * 10),
])
def test_round_geometry_creates_actual_radial_diametric_and_arc_length_measurements(page, tmp_path, source, kind, value):
    workspace(page)
    toolbar(page, source).click()
    source_id = entities(page).last.get_attribute('data-drawing-id')
    toolbar(page, 'Размеры').click()
    dialog = page.get_by_role('dialog', name='Редактор размера', exact=True)
    dialog.get_by_label('Тип размера', exact=True).select_option(kind)
    dialog.get_by_label('Источник A', exact=True).select_option(source_id)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    graphic = dimension_graphics(page).last
    expect(graphic).to_have_attribute('data-dimension-kind', kind)
    assert float(graphic.get_attribute('data-dimension-value')) == pytest.approx(value)
    assert graphic.locator('[data-dimension-primitive]').count() > 0
    saved = save_document(page, tmp_path)
    definition = saved['drawing']['sheets'][0]['entities'][-1]['dimension']
    assert definition['refs'][0]['entityId'] == source_id
    assert 'frozen' not in definition
    page.reload(wait_until='domcontentloaded')
    workspace(page)
    assert float(dimension_graphics(page).last.get_attribute('data-dimension-value')) == pytest.approx(value)
    sheet(page).locator(f'[data-drawing-id="{source_id}"] [data-drawing-ui="true"]').scroll_into_view_if_needed()
    # Pick visible source geometry away from the dimension's actual lines/text.
    source_point = [120 + 20 / math.sqrt(2), 90 + 20 / math.sqrt(2)] if source == 'Дуга' else [140, 130]
    screen = sheet(page).evaluate('(svg, p) => {const q = new DOMPoint(...p).matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y};}', source_point)
    page.mouse.dblclick(screen['x'], screen['y'])
    geometry_editor = page.get_by_role('dialog', name='Геометрия опоры', exact=True)
    expect(geometry_editor).to_be_visible()
    if source == 'Дуга':
        geometry_editor.get_by_label('Радиус дуги', exact=True).fill('40')
    else:
        geometry_editor.get_by_label('Ширина опоры', exact=True).fill('80')
        geometry_editor.get_by_label('Высота опоры', exact=True).fill('80')
    geometry_editor.get_by_role('button', name='ОК', exact=True).click()
    expect(geometry_editor).not_to_be_visible()
    assert float(dimension_graphics(page).last.get_attribute('data-dimension-value')) == pytest.approx(value * 2)


@pytest.mark.parametrize('identifier,group_type,values', [
    ('DIM-017', 'chain', [10, 20]),
    ('DIM-018', 'baseline', [10, 30]),
    ('DIM-019', 'ordinate', [0, 10, 30]),
])
def test_dimension_group_uses_shared_real_sources_and_one_history_transaction(page, tmp_path, identifier, group_type, values):
    workspace(page)
    drawing, first = line_drawing(page, tmp_path)
    first.update(x=40, y=40, width=10, height=1)
    first['geometry']['points'] = [[0, 0], [10, 0]]
    second = json.loads(json.dumps(first))
    second.update(id='group-source-b', name='Вторая опора', x=50, width=20)
    second['geometry']['points'] = [[0, 0], [20, 0]]
    drawing['sheets'][0]['entities'].append(second)
    import_drawing(page, drawing)
    first_ui = sheet(page).locator(f'[data-drawing-id="{first["id"]}"]')
    expect(first_ui).to_have_attribute('aria-pressed', 'false')
    first_ui.locator('[data-drawing-ui="true"]').click()
    second_ui = sheet(page).locator('[data-drawing-id="group-source-b"]')
    second_ui.locator('[data-drawing-ui="true"]').click(modifiers=['Control'])
    expect(first_ui).to_have_attribute('aria-pressed', 'true')
    expect(second_ui).to_have_attribute('aria-pressed', 'true')
    page.get_by_role('navigation', name='Категория аннотаций').get_by_role('button', name='Размеры', exact=True).click()
    page.locator(f'[data-dimension-command="{identifier}"]').click()
    dialog = page.get_by_role('dialog', name='Группа размеров', exact=True)
    dialog.get_by_label('Угол направления группы', exact=True).fill('0')
    dialog.get_by_label('Отступ группы', exact=True).fill('12')
    dialog.get_by_label('Интервал группы', exact=True).fill('7')
    dialog.get_by_label('X начала группы', exact=True).fill('40')
    dialog.get_by_label('Y начала группы', exact=True).fill('40')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dimension_graphics(page)).to_have_count(len(values))
    measured = dimension_graphics(page).evaluate_all('(nodes) => nodes.map(n => Number(n.dataset.dimensionValue))')
    assert measured == values
    saved = save_document(page, tmp_path)
    definitions = [entity['dimension'] for entity in saved['drawing']['sheets'][0]['entities'] if 'dimension' in entity]
    assert {definition['groupType'] for definition in definitions} == {group_type}
    assert len({definition['groupId'] for definition in definitions}) == 1
    assert all(ref['entityId'] in [first['id'], second['id']] for definition in definitions for ref in definition['refs'])
    if group_type == 'baseline':
        assert definitions[0]['refs'][0] == definitions[1]['refs'][0]
    elif group_type == 'chain':
        assert definitions[0]['refs'][1] == definitions[1]['refs'][0]
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(dimension_graphics(page)).to_have_count(0)
    expect(entities(page)).to_have_count(2)
    page.keyboard.press('Control+y')
    expect(dimension_graphics(page)).to_have_count(len(values))
    expect(entities(page)).to_have_count(2 + len(values))
