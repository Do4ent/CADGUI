"""Circular sketch sources and exact disk/sector extrusion, without polygon fakes."""
import json
import math

import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_drawing import save_document
from test_kernel import prepare, rows as exact_rows
from test_sketch import panel, sketch_rows, extrude, inspect, select_sketch, start_sketch


def open_curve(page, kind='circle', radius=2, plane='XY'):
    panel(page).get_by_role('button', name='Создать окружность' if kind == 'circle' else 'Создать дугу', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    dialog.get_by_label('Радиус эскиза', exact=True).fill(str(radius))
    dialog.get_by_label('Плоскость', exact=True).select_option(plane)
    return dialog


def create_curve(page, kind='circle', radius=2, plane='XY'):
    dialog = open_curve(page, kind, radius, plane)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    return sketch_rows(page).first.get_attribute('data-sketch-id')


def source(document):
    assert document['schemaVersion'] == 7
    return document['sketchModel']


@pytest.mark.parametrize('kind,volume', [('circle', 12 * math.pi), ('arc', 6 * math.pi)])
def test_real_curve_editor_and_occt_disk_or_semicircle_sector_volume(page, tmp_path, kind, volume):
    prepare(page)
    dialog = open_curve(page, kind)
    curve = dialog.locator(f'[data-sketch-curve="{kind}"]')
    expect(curve).to_have_count(1)
    if kind == 'circle':
        assert float(curve.get_attribute('r')) == pytest.approx(2, abs=1e-7)
    else:
        assert float(curve.get_attribute('data-sketch-arc-sweep')) == pytest.approx(math.pi, abs=1e-7)
        assert 'A' in curve.get_attribute('d')
        expect(dialog.get_by_label('Замкнутый профиль', exact=True)).to_be_checked()
    dialog.get_by_role('button', name='ОК', exact=True).click()
    extrude(page, 3)
    saved = save_document(page, tmp_path)
    model = source(saved)
    assert model['sketches'][0]['geometry']['kind'] == kind
    assert len(model['sketches'][0]['points']) == (2 if kind == 'circle' else 3)
    result = inspect(page, model['extrusions'][0]['bodyId'])
    assert result['volume'] == pytest.approx(volume, rel=1e-7)


@pytest.mark.parametrize('kind,area_factor', [('circle', math.pi), ('arc', math.pi / 2)])
def test_radius_edit_rebuilds_all_linked_depths_same_ids_and_one_undo_restores_source(page, tmp_path, kind, area_factor):
    prepare(page)
    sketch_id = create_curve(page, kind)
    extrude(page, 3)
    select_sketch(page, sketch_id)
    extrude(page, 2)
    before = save_document(page, tmp_path, 'radius-before.json')
    features = source(before)['extrusions']
    select_sketch(page, sketch_id)
    panel(page).get_by_role('button', name='Редактировать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    dialog.get_by_label('Радиус эскиза', exact=True).fill('3')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    after = save_document(page, tmp_path, 'radius-after.json')
    assert source(after)['extrusions'] == features
    for feature in features:
        assert inspect(page, feature['bodyId'])['volume'] == pytest.approx(area_factor * 9 * feature['depth'], rel=1e-7)
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    undone = save_document(page, tmp_path, 'radius-undone.json')
    assert source(undone) == source(before)
    assert undone['exactModel'] == before['exactModel']


def test_native_schema6_reopen_and_recovery_preserve_arc_source_and_exact_volume(page, tmp_path):
    prepare(page)
    create_curve(page, 'arc')
    extrude(page, 3)
    before = save_document(page, tmp_path, 'arc-source.json')
    body_id = source(before)['extrusions'][0]['bodyId']
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({
        'name': 'arc-source.json', 'mimeType': 'application/json', 'buffer': json.dumps(before).encode(),
    })
    expect(page.get_by_role('tablist', name='Документы').get_by_role('tab')).to_have_count(2, timeout=120000)
    assert inspect(page, body_id)['volume'] == pytest.approx(6 * math.pi, rel=1e-7)
    reopened = save_document(page, tmp_path, 'arc-reopened.json')
    assert source(reopened) == source(before)
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    prepare(page)
    assert inspect(page, body_id)['volume'] == pytest.approx(6 * math.pi, rel=1e-7)
    recovered = save_document(page, tmp_path, 'arc-recovered.json')
    assert source(recovered) == source(before)
    assert all(body['brep'].lstrip().startswith(('CASCADE Topology', 'DBRep_DrawableShape')) for body in recovered['exactModel']['bodies'])


@pytest.mark.parametrize('plane,depth,extents', [('XY', -3, [4, 4, 3]), ('XZ', 3, [4, 3, 4]), ('YZ', -3, [3, 4, 4])])
def test_circular_extrusion_plane_and_signed_depth_match_actual_bounds(page, tmp_path, plane, depth, extents):
    prepare(page)
    create_curve(page, plane=plane)
    extrude(page, depth)
    saved = save_document(page, tmp_path)
    model = source(saved)
    assert model['sketches'][0]['plane'] == plane
    assert model['extrusions'][0]['depth'] == depth
    result = inspect(page, model['extrusions'][0]['bodyId'])
    assert result['volume'] == pytest.approx(12 * math.pi, rel=1e-7)
    assert [high - low for low, high in zip(*result['bounds'])] == pytest.approx(extents, abs=1e-6)


def test_clockwise_sector_uses_opposite_arc_and_open_arc_cannot_create_body(page, tmp_path):
    prepare(page)
    dialog = open_curve(page, 'arc')
    dialog.get_by_label('Против часовой стрелки', exact=True).uncheck()
    arc = dialog.locator('[data-sketch-curve="arc"]')
    assert float(arc.get_attribute('data-sketch-arc-sweep')) == pytest.approx(-math.pi, abs=1e-7)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    extrude(page, 3)
    saved = save_document(page, tmp_path, 'clockwise.json')
    model = source(saved)
    assert model['sketches'][0]['geometry']['ccw'] is False
    result = inspect(page, model['extrusions'][0]['bodyId'])
    assert result['volume'] == pytest.approx(6 * math.pi, rel=1e-7)
    # A separate unclosed arc is a valid source, but cannot be made a solid.
    dialog = open_curve(page, 'arc')
    dialog.get_by_label('Замкнутый профиль', exact=True).uncheck()
    dialog.get_by_role('button', name='ОК', exact=True).click()
    before = save_document(page, tmp_path, 'open-before.json')
    panel(page).get_by_role('button', name='Выдавить эскиз', exact=True).click()
    extrusion = page.get_by_role('dialog', name='Выдавливание эскиза', exact=True)
    extrusion.get_by_label('Глубина выдавливания', exact=True).fill('3')
    extrusion.get_by_role('button', name='ОК', exact=True).click()
    expect(extrusion.get_by_role('alert')).to_be_visible(timeout=120000)
    expect(exact_rows(page)).to_have_count(1)
    extrusion.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'open-after.json') == before


def test_distance_and_equal_length_constraints_are_solved_and_persisted_not_text_labels(page, tmp_path):
    prepare(page)
    dialog = start_sketch(page, width=3, height=4)
    ids = dialog.locator('[data-sketch-point-id]').evaluate_all('(nodes) => nodes.map(node => node.dataset.sketchPointId)')
    dialog.get_by_label('Тип ограничения', exact=True).select_option('distance')
    dialog.get_by_label('Первая точка', exact=True).select_option(ids[0])
    dialog.get_by_label('Вторая точка', exact=True).select_option(ids[2])
    dialog.get_by_label('Значение ограничения', exact=True).fill('5')
    dialog.get_by_role('button', name='Добавить ограничение', exact=True).click()
    expect(dialog.locator('[data-sketch-editor-valid]')).to_have_attribute('data-sketch-editor-valid', 'true')
    dialog.get_by_label('Тип ограничения', exact=True).select_option('equal-length')
    for label, identifier in [('Первая точка', ids[0]), ('Вторая точка', ids[1]), ('Третья точка', ids[3]), ('Четвёртая точка', ids[2])]:
        dialog.get_by_label(label, exact=True).select_option(identifier)
    dialog.get_by_role('button', name='Добавить ограничение', exact=True).click()
    expect(dialog.locator('[data-sketch-editor-valid]')).to_have_attribute('data-sketch-editor-valid', 'true')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    saved = save_document(page, tmp_path)
    sketch = source(saved)['sketches'][0]
    assert any(c['kind'] == 'distance' and c['value'] == 5 for c in sketch['constraints'])
    assert any(c['kind'] == 'equal-length' for c in sketch['constraints'])
    points = {point['id']: point for point in sketch['points']}
    assert math.hypot(points[ids[2]]['x'] - points[ids[0]]['x'], points[ids[2]]['y'] - points[ids[0]]['y']) == pytest.approx(5, abs=1e-7)
