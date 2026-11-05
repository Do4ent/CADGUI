"""Ordered line/arc sources and exact OCCT extrusion of a capsule."""
import copy
import json
import math

import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_drawing import save_document
from test_kernel import prepare, create_box, rows as exact_rows
from test_sketch import panel, sketch_rows, extrude, inspect, select_sketch


def open_mixed(page, length=6, radius=2, plane='XY'):
    panel(page).get_by_role('button', name='Создать смешанный контур', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    dialog.get_by_label('Длина прямой части', exact=True).fill(str(length))
    dialog.get_by_label('Радиус эскиза', exact=True).fill(str(radius))
    dialog.get_by_label('Плоскость', exact=True).select_option(plane)
    return dialog


def create_mixed(page, **kwargs):
    dialog = open_mixed(page, **kwargs)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    return sketch_rows(page).first.get_attribute('data-sketch-id')


def model(document):
    assert document['schemaVersion'] == 10
    return document['sketchModel']


def upload(page, document, name):
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({
        'name': name, 'mimeType': 'application/json', 'buffer': json.dumps(document).encode(),
    })


def test_actual_mixed_svg_and_exact_capsule_volume_bounds(page, tmp_path):
    prepare(page)
    dialog = open_mixed(page)
    expect(dialog.locator('[data-sketch-segment-kind="line"]')).to_have_count(2)
    arcs = dialog.locator('[data-sketch-segment-kind="arc"]')
    expect(arcs).to_have_count(2)
    for arc in arcs.all():
        assert 'A' in arc.get_attribute('d')
        assert float(arc.get_attribute('data-sketch-arc-sweep')) == pytest.approx(math.pi)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    extrude(page, 3)
    state = model(save_document(page, tmp_path))
    segments = state['sketches'][0]['geometry']['segments']
    assert [segment['kind'] for segment in segments] == ['line', 'arc', 'line', 'arc']
    assert all(segment['end'] == segments[(i + 1) % 4]['start'] for i, segment in enumerate(segments))
    result = inspect(page, state['extrusions'][0]['bodyId'])
    assert result['volume'] == pytest.approx(72 + 12 * math.pi, rel=1e-7)
    assert result['bounds'][0] == pytest.approx([-2, -2, 0], abs=1e-6)
    assert result['bounds'][1] == pytest.approx([8, 2, 3], abs=1e-6)


def test_length_radius_edit_rebuilds_both_owned_bodies_and_undo_is_atomic(page, tmp_path):
    prepare(page)
    sketch_id = create_mixed(page)
    extrude(page, 3)
    select_sketch(page, sketch_id)
    extrude(page, 2)
    before = save_document(page, tmp_path, 'mixed-before.json')
    select_sketch(page, sketch_id)
    panel(page).get_by_role('button', name='Редактировать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    dialog.get_by_label('Длина прямой части', exact=True).fill('8')
    dialog.get_by_label('Радиус эскиза', exact=True).fill('3')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    after = save_document(page, tmp_path, 'mixed-after.json')
    assert model(after)['extrusions'] == model(before)['extrusions']
    for feature in model(after)['extrusions']:
        assert inspect(page, feature['bodyId'])['volume'] == pytest.approx((48 + 9 * math.pi) * feature['depth'], rel=1e-7)
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    undone = save_document(page, tmp_path, 'mixed-undone.json')
    assert model(undone) == model(before)
    assert undone['exactModel'] == before['exactModel']


@pytest.mark.parametrize('plane,depth,extents', [
    ('XY', -3, [10, 4, 3]), ('XZ', 3, [10, 3, 4]), ('YZ', -3, [3, 10, 4]),
])
def test_mixed_signed_extrusion_uses_actual_plane_bounds(page, tmp_path, plane, depth, extents):
    prepare(page)
    create_mixed(page, plane=plane)
    extrude(page, depth)
    state = model(save_document(page, tmp_path))
    assert state['sketches'][0]['plane'] == plane
    assert state['extrusions'][0]['depth'] == depth
    result = inspect(page, state['extrusions'][0]['bodyId'])
    assert result['volume'] == pytest.approx(72 + 12 * math.pi, rel=1e-7)
    assert [hi - lo for lo, hi in zip(*result['bounds'])] == pytest.approx(extents, abs=1e-6)


def test_schema7_native_source_rebuilds_wrong_cache_and_survives_recovery(page, tmp_path):
    prepare(page)
    create_mixed(page)
    extrude(page, 3)
    create_box(page, size=(1, 1, 1), origin=(20, 0, 0))
    before = save_document(page, tmp_path, 'mixed-native.json')
    body_id = model(before)['extrusions'][0]['bodyId']
    unrelated = next(body for body in before['exactModel']['bodies'] if body['id'] != body_id)
    tampered = copy.deepcopy(before)
    next(body for body in tampered['exactModel']['bodies'] if body['id'] == body_id)['brep'] = unrelated['brep']
    upload(page, tampered, 'mixed-wrong-cache.json')
    expect(page.get_by_role('tablist', name='Документы').get_by_role('tab')).to_have_count(2, timeout=120000)
    assert inspect(page, body_id)['volume'] == pytest.approx(72 + 12 * math.pi, rel=1e-7)
    rebuilt = save_document(page, tmp_path, 'mixed-rebuilt.json')
    assert model(rebuilt) == model(before)
    assert next(body for body in rebuilt['exactModel']['bodies'] if body['id'] != body_id) == unrelated
    assert next(body for body in rebuilt['exactModel']['bodies'] if body['id'] == body_id)['brep'] != unrelated['brep']
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    prepare(page)
    assert inspect(page, body_id)['volume'] == pytest.approx(72 + 12 * math.pi, rel=1e-7)
    assert model(save_document(page, tmp_path, 'mixed-recovered.json')) == model(before)


@pytest.mark.parametrize('corruption', ['missing-point', 'broken-order'])
def test_malformed_mixed_import_preserves_document_atomically(page, tmp_path, corruption):
    prepare(page)
    create_mixed(page)
    extrude(page, 3)
    before = save_document(page, tmp_path, 'mixed-valid.json')
    malformed = copy.deepcopy(before)
    segments = model(malformed)['sketches'][0]['geometry']['segments']
    if corruption == 'missing-point':
        segments[1]['center'] = 'not-present'
    else:
        segments[0], segments[1] = segments[1], segments[0]
    upload(page, malformed, 'malformed-mixed.json')
    expect(page.get_by_role('alert').filter(has_text='Смешанный')).to_be_visible(timeout=120000)
    expect(page.get_by_role('tablist', name='Документы').get_by_role('tab')).to_have_count(1)
    assert save_document(page, tmp_path, 'mixed-after-invalid.json') == before


def test_open_mixed_source_cannot_extrude_and_cancel_preserves_document(page, tmp_path):
    prepare(page)
    dialog = open_mixed(page)
    dialog.get_by_label('Замкнутый профиль', exact=True).uncheck()
    dialog.get_by_role('button', name='ОК', exact=True).click()
    before = save_document(page, tmp_path, 'mixed-open.json')
    assert model(before)['sketches'][0]['closed'] is False
    panel(page).get_by_role('button', name='Выдавить эскиз', exact=True).click()
    extrusion = page.get_by_role('dialog', name='Выдавливание эскиза', exact=True)
    extrusion.get_by_label('Глубина выдавливания', exact=True).fill('3')
    extrusion.get_by_role('button', name='ОК', exact=True).click()
    expect(extrusion.get_by_role('alert')).to_be_visible(timeout=120000)
    expect(exact_rows(page)).to_have_count(0)
    extrusion.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'mixed-open-after.json') == before


def test_angle_and_adjacent_tangent_solve_then_contradictory_angle_blocks_confirm(page, tmp_path):
    prepare(page)
    dialog = open_mixed(page)
    # Replace an actual capsule tangent with the user-created equivalent.
    dialog.get_by_role('button', name='Удалить ограничение t1', exact=True).click()
    dialog.get_by_label('Тип ограничения', exact=True).select_option('tangent')
    for label, identifier in [('Центр дуги', 'cl'), ('Точка касания', 'bl'), ('Другая точка линии', 'br')]:
        dialog.get_by_label(label, exact=True).select_option(identifier)
    dialog.get_by_role('button', name='Добавить ограничение', exact=True).click()
    expect(dialog.locator('[data-sketch-editor-valid]')).to_have_attribute('data-sketch-editor-valid', 'true')
    dialog.get_by_label('Тип ограничения', exact=True).select_option('angle')
    for label, identifier in [('Первая точка', 'bl'), ('Вторая точка', 'br'), ('Третья точка', 'cl'), ('Четвёртая точка', 'cr')]:
        dialog.get_by_label(label, exact=True).select_option(identifier)
    dialog.get_by_label('Значение ограничения', exact=True).fill('0')
    dialog.get_by_role('button', name='Добавить ограничение', exact=True).click()
    expect(dialog.locator('[data-sketch-editor-valid]')).to_have_attribute('data-sketch-editor-valid', 'true')
    points = dialog.locator('[data-sketch-point-id]')
    snapshot = points.evaluate_all('(nodes) => nodes.map(n => [n.dataset.sketchPointId,n.dataset.sketchPointX,n.dataset.sketchPointY])')
    count = dialog.locator('[data-sketch-constraint-id]').count()
    dialog.get_by_label('Значение ограничения', exact=True).fill('90')
    dialog.get_by_role('button', name='Добавить ограничение', exact=True).click()
    expect(dialog.locator('[data-sketch-draft-status]')).to_have_attribute('data-sketch-draft-status', 'rejected')
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    expect(dialog.locator('[data-sketch-constraint-id]')).to_have_count(count)
    assert points.evaluate_all('(nodes) => nodes.map(n => [n.dataset.sketchPointId,n.dataset.sketchPointX,n.dataset.sketchPointY])') == snapshot
    dialog.get_by_role('button', name='Отменить неудачное изменение', exact=True).click()
    dialog.get_by_role('button', name='ОК', exact=True).click()
    state = model(save_document(page, tmp_path))
    sketch = state['sketches'][0]
    assert any(c['kind'] == 'angle' and c['value'] == 0 for c in sketch['constraints'])
    assert not any(c['kind'] == 'angle' and c['value'] == 90 for c in sketch['constraints'])
    assert any(c['kind'] == 'tangent' and (c['center'], c['point'], c['other']) == ('cl', 'bl', 'br') for c in sketch['constraints'])
    points = {point['id']: point for point in sketch['points']}
    radius = [points['bl'][axis] - points['cl'][axis] for axis in ('x', 'y')]
    line = [points['br'][axis] - points['bl'][axis] for axis in ('x', 'y')]
    assert sum(a * b for a, b in zip(radius, line)) == pytest.approx(0, abs=1e-7)


def test_mixed_locked_point_rejection_preserves_source_and_owned_body(page, tmp_path):
    prepare(page)
    sketch_id = create_mixed(page)
    extrude(page, 3)
    before = save_document(page, tmp_path, 'mixed-locked-before.json')
    select_sketch(page, sketch_id)
    panel(page).get_by_role('button', name='Редактировать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    field = dialog.get_by_label('X cl', exact=True)
    field.fill('1')
    field.press('Enter')
    expect(dialog.locator('[data-sketch-draft-status]')).to_have_attribute('data-sketch-draft-status', 'rejected')
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    baseline_x = next(p['x'] for p in before['sketchModel']['sketches'][0]['points'] if p['id'] == 'cl')
    assert float(dialog.locator('[data-sketch-point-id="cl"]').get_attribute('data-sketch-point-x')) == pytest.approx(baseline_x, abs=1e-12)
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'mixed-locked-after.json') == before


def test_staged_broken_segment_chain_keeps_accepted_svg_and_cancel_preserves_native(page, tmp_path):
    prepare(page)
    sketch_id = create_mixed(page)
    extrude(page, 3)
    before = save_document(page, tmp_path, 'mixed-segments-before.json')
    select_sketch(page, sketch_id)
    panel(page).get_by_role('button', name='Редактировать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    accepted_path = dialog.locator('[data-sketch-mixed-path]').get_attribute('d')
    points = dialog.locator('[data-sketch-point-id]')
    accepted_points = points.evaluate_all('(nodes) => nodes.map(n => [n.dataset.sketchPointId,n.dataset.sketchPointX,n.dataset.sketchPointY])')
    # bottom ends at br; changing the next edge start to bl breaks ordered connectivity.
    dialog.get_by_label('Начало сегмента right', exact=True).select_option('bl')
    expect(dialog.locator('[data-sketch-segment-draft]')).to_be_visible()
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    assert dialog.locator('[data-sketch-mixed-path]').get_attribute('d') == accepted_path
    dialog.get_by_role('button', name='Применить сегменты', exact=True).click()
    expect(dialog.get_by_role('alert')).to_contain_text('Изменение не применено')
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    assert dialog.locator('[data-sketch-mixed-path]').get_attribute('d') == accepted_path
    assert points.evaluate_all('(nodes) => nodes.map(n => [n.dataset.sketchPointId,n.dataset.sketchPointX,n.dataset.sketchPointY])') == accepted_points
    dialog.get_by_role('button', name='Отменить сегменты', exact=True).click()
    expect(dialog.get_by_label('Начало сегмента right', exact=True)).to_have_value('br')
    expect(dialog.locator('[data-sketch-segment-draft]')).to_have_count(0)
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_enabled()
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'mixed-segments-after.json') == before
