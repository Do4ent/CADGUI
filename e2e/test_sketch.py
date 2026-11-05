"""Sketch sources, actual OCCT extrusion and transactional dependency rebuilds."""
import json
import re

import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_drawing import save_document
from test_kernel import prepare, panel as exact_panel, rows as exact_rows, stats, create_box


def panel(page):
    return page.get_by_role('region', name='Эскизы и выдавливания', exact=True)


def sketch_rows(page):
    return panel(page).locator('[data-sketch-id]')


def start_sketch(page, width=2, height=3, plane='XY'):
    panel(page).get_by_role('button', name='Создать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    dialog.get_by_label('Название эскиза', exact=True).fill('Профиль 2×3')
    dialog.get_by_label('Плоскость', exact=True).select_option(plane)
    dialog.get_by_label('Ширина эскиза', exact=True).fill(str(width))
    dialog.get_by_label('Высота эскиза', exact=True).fill(str(height))
    return dialog


def create_sketch(page, width=2, height=3, plane='XY'):
    dialog = start_sketch(page, width, height, plane)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    expect(sketch_rows(page)).to_have_count(1)
    return sketch_rows(page).first.get_attribute('data-sketch-id')


def extrude(page, depth=4):
    count = exact_rows(page).count()
    panel(page).get_by_role('button', name='Выдавить эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Выдавливание эскиза', exact=True)
    dialog.get_by_label('Глубина выдавливания', exact=True).fill(str(depth))
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(exact_rows(page)).to_have_count(count + 1, timeout=120000)
    expect(dialog).not_to_be_visible(timeout=120000)


def inspect(page, body_id):
    exact_panel(page).locator(f'[data-exact-body-row="{body_id}"]').get_by_role('button').click()
    exact_panel(page).get_by_role('button', name='Проверить тело', exact=True).click()
    return stats(page)


def model(document):
    assert document['schemaVersion'] == 8
    state = document['sketchModel']
    assert state['version'] == 1
    assert state['units'] == 'mm'
    return state


def select_sketch(page, sketch_id):
    panel(page).locator(f'[data-sketch-id="{sketch_id}"]').get_by_role('button').first.click()


def edit_width(page, sketch_id, width):
    select_sketch(page, sketch_id)
    panel(page).get_by_role('button', name='Редактировать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    dialog.get_by_label('Ширина эскиза', exact=True).fill(str(width))
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)


def test_rectangle_extrusion_and_width_edit_rebuild_the_same_real_body(page, tmp_path):
    prepare(page)
    sketch_id = create_sketch(page)
    extrude(page)
    before = save_document(page, tmp_path, 'before-edit.json')
    feature = model(before)['extrusions'][0]
    assert feature['sketchId'] == sketch_id
    assert feature['depth'] == 4
    body_id = feature['bodyId']
    assert inspect(page, body_id)['volume'] == pytest.approx(24, rel=1e-9)
    edit_width(page, sketch_id, 5)
    after = save_document(page, tmp_path, 'after-edit.json')
    assert model(after)['extrusions'][0]['bodyId'] == body_id
    assert inspect(page, body_id)['volume'] == pytest.approx(60, rel=1e-9)
    assert before['exactModel']['bodies'][0]['brep'] != after['exactModel']['bodies'][0]['brep']


def test_one_sketch_rebuilds_two_depths_and_undo_restores_all_dependents(page, tmp_path):
    prepare(page)
    sketch_id = create_sketch(page)
    extrude(page, 4)
    select_sketch(page, sketch_id)
    extrude(page, 2)
    before = save_document(page, tmp_path, 'two-depths-before.json')
    features = model(before)['extrusions']
    assert len(features) == 2
    edit_width(page, sketch_id, 5)
    changed = save_document(page, tmp_path, 'two-depths-after.json')
    assert [feature['bodyId'] for feature in model(changed)['extrusions']] == [feature['bodyId'] for feature in features]
    for feature in features:
        assert inspect(page, feature['bodyId'])['volume'] == pytest.approx(5 * 3 * feature['depth'], rel=1e-9)
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    undone = save_document(page, tmp_path, 'two-depths-undone.json')
    assert model(undone) == model(before)
    assert undone['exactModel'] == before['exactModel']
    for feature in features:
        assert inspect(page, feature['bodyId'])['volume'] == pytest.approx(2 * 3 * feature['depth'], rel=1e-9)


def test_cancel_and_invalid_extrusion_leave_sources_and_brep_unchanged(page, tmp_path):
    prepare(page)
    before = save_document(page, tmp_path, 'before-cancel.json')
    dialog = start_sketch(page)
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    expect(sketch_rows(page)).to_have_count(0)
    assert save_document(page, tmp_path, 'after-cancel.json') == before
    create_sketch(page)
    baseline = save_document(page, tmp_path, 'before-invalid-depth.json')
    panel(page).get_by_role('button', name='Выдавить эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Выдавливание эскиза', exact=True)
    dialog.get_by_label('Глубина выдавливания', exact=True).fill('0')
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'after-invalid-depth.json') == baseline


def test_native_reopen_rebuilds_owned_cache_and_preserves_unrelated_exact_body(page, tmp_path):
    prepare(page)
    create_sketch(page)
    extrude(page)
    create_box(page, size=(1, 1, 1), origin=(10, 0, 0))
    before = save_document(page, tmp_path, 'native-source.json')
    body_id = model(before)['extrusions'][0]['bodyId']
    other = next(body for body in before['exactModel']['bodies'] if body['id'] != body_id)
    tampered = json.loads(json.dumps(before))
    next(body for body in tampered['exactModel']['bodies'] if body['id'] == body_id)['brep'] = other['brep']
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({
        'name': 'valid-source-wrong-cache.json', 'mimeType': 'application/json', 'buffer': json.dumps(tampered).encode(),
    })
    expect(page.get_by_role('tablist', name='Документы').get_by_role('tab')).to_have_count(2, timeout=120000)
    expect(exact_rows(page)).to_have_count(2, timeout=120000)
    assert inspect(page, body_id)['volume'] == pytest.approx(24, rel=1e-9)
    rebuilt = save_document(page, tmp_path, 'native-rebuilt.json')
    assert model(rebuilt) == model(before)
    assert next(body for body in rebuilt['exactModel']['bodies'] if body['id'] != body_id) == other
    assert next(body for body in rebuilt['exactModel']['bodies'] if body['id'] == body_id)['brep'] != other['brep']
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    prepare(page)
    assert inspect(page, body_id)['volume'] == pytest.approx(24, rel=1e-9)
    restored = save_document(page, tmp_path, 'recovered.json')
    assert model(restored) == model(before)


def test_delete_sketch_cascades_only_owned_bodies_and_exact_delete_prunes_feature(page, tmp_path):
    prepare(page)
    sketch_id = create_sketch(page)
    extrude(page, 4)
    select_sketch(page, sketch_id)
    extrude(page, 2)
    create_box(page, size=(1, 1, 1), origin=(10, 0, 0))
    before = save_document(page, tmp_path, 'before-delete.json')
    features = model(before)['extrusions']
    owned_ids = {feature['bodyId'] for feature in features}
    unrelated = next(body for body in before['exactModel']['bodies'] if body['id'] not in owned_ids)
    inspect(page, features[0]['bodyId'])
    exact_panel(page).get_by_role('button', name='Удалить тело', exact=True).click()
    expect(exact_rows(page)).to_have_count(2)
    pruned = save_document(page, tmp_path, 'pruned-feature.json')
    assert [feature['bodyId'] for feature in model(pruned)['extrusions']] == [features[1]['bodyId']]
    select_sketch(page, sketch_id)
    panel(page).get_by_role('button', name='Удалить эскиз и тела', exact=True).click()
    expect(sketch_rows(page)).to_have_count(0)
    expect(exact_rows(page)).to_have_count(1)
    after = save_document(page, tmp_path, 'after-cascade.json')
    assert model(after)['sketches'] == []
    assert model(after)['extrusions'] == []
    assert after['exactModel']['bodies'] == [unrelated]


@pytest.mark.parametrize('plane,depth,extents', [
    ('XY', -4, [2, 3, 4]),
    ('XZ', 4, [2, 4, 3]),
    ('YZ', -4, [4, 2, 3]),
])
def test_signed_extrusion_uses_the_sketch_plane_and_actual_occt_bounds(page, tmp_path, plane, depth, extents):
    prepare(page)
    create_sketch(page, plane=plane)
    extrude(page, depth)
    saved = save_document(page, tmp_path)
    state = model(saved)
    assert state['sketches'][0]['plane'] == plane
    assert state['extrusions'][0]['depth'] == depth
    result = inspect(page, state['extrusions'][0]['bodyId'])
    assert result['volume'] == pytest.approx(24, rel=1e-9)
    actual_extents = [high - low for low, high in zip(*result['bounds'])]
    assert actual_extents == pytest.approx(extents, abs=1e-6)


def test_conflicting_constraint_is_rejected_without_altering_source_or_owned_body(page, tmp_path):
    prepare(page)
    sketch_id = create_sketch(page)
    extrude(page)
    before = save_document(page, tmp_path, 'before-conflict.json')
    select_sketch(page, sketch_id)
    panel(page).get_by_role('button', name='Редактировать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    points = dialog.locator('[data-sketch-point-id]')
    point_ids = points.evaluate_all('(nodes) => nodes.map(node => node.dataset.sketchPointId)')
    coordinates = points.evaluate_all('(nodes) => nodes.map(node => [node.dataset.sketchPointX, node.dataset.sketchPointY])')
    count = dialog.locator('[data-sketch-constraint-id]').count()
    dialog.get_by_label('Тип ограничения', exact=True).select_option('dx')
    dialog.get_by_label('Первая точка', exact=True).select_option(point_ids[0])
    dialog.get_by_label('Вторая точка', exact=True).select_option(point_ids[1])
    dialog.get_by_label('Значение ограничения', exact=True).fill('999')
    dialog.get_by_role('button', name='Добавить ограничение', exact=True).click()
    expect(dialog.locator('[data-sketch-draft-status]')).to_have_attribute('data-sketch-draft-status', 'rejected')
    expect(dialog.get_by_role('alert')).to_contain_text('Изменение не применено')
    expect(dialog.locator('[data-sketch-constraint-id]')).to_have_count(count)
    assert points.evaluate_all('(nodes) => nodes.map(node => [node.dataset.sketchPointX, node.dataset.sketchPointY])') == coordinates
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'after-conflict.json') == before


def test_free_sketch_point_drag_respects_grid_and_persists_real_coordinates(page, tmp_path):
    prepare(page)
    sketch_id = create_sketch(page)
    select_sketch(page, sketch_id)
    panel(page).get_by_role('button', name='Редактировать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    removals = dialog.get_by_role('button', name=re.compile(r'^Удалить ограничение '))
    while removals.count():
        removals.first.click()
    expect(dialog.locator('[data-sketch-solver-status]')).to_have_attribute('data-sketch-solver-status', 'under-constrained')
    point = dialog.locator('[data-sketch-point-id]').first
    point_id = point.get_attribute('data-sketch-point-id')
    svg = dialog.get_by_role('group', name='Геометрия эскиза', exact=True)
    def drag_to(x, y):
        point.scroll_into_view_if_needed()
        positions = svg.evaluate('''(svg, target) => {
          const node = svg.querySelector('[data-sketch-point-id]');
          const matrix = svg.getScreenCTM();
          const start = new DOMPoint(Number(node.dataset.sketchPointX), -Number(node.dataset.sketchPointY)).matrixTransform(matrix);
          const end = new DOMPoint(target[0], -target[1]).matrixTransform(matrix);
          return {start:{x:start.x,y:start.y},end:{x:end.x,y:end.y}};
        }''', [x, y])
        page.mouse.move(**positions['start'])
        page.mouse.down()
        page.mouse.move(**positions['end'], steps=10)
        page.mouse.up()
    dialog.get_by_label('Сетка 1 мм', exact=True).check()
    drag_to(1.2, 0.7)
    expect(point).to_have_attribute('data-sketch-point-x', '1')
    expect(point).to_have_attribute('data-sketch-point-y', '1')
    dialog.get_by_label('Сетка 1 мм', exact=True).uncheck()
    drag_to(1.25, 0.75)
    assert float(point.get_attribute('data-sketch-point-x')) == pytest.approx(1.25, abs=1e-6)
    assert float(point.get_attribute('data-sketch-point-y')) == pytest.approx(0.75, abs=1e-6)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible()
    source = model(save_document(page, tmp_path))['sketches'][0]
    assert source['constraints'] == []
    saved_point = next(point for point in source['points'] if point['id'] == point_id)
    assert [saved_point['x'], saved_point['y']] == pytest.approx([1.25, 0.75], abs=1e-6)


@pytest.mark.parametrize('target', ['point', 'constraint'])
@pytest.mark.parametrize('invalid', ['', '1e309'], ids=['blank', 'nonfinite'])
def test_uncommitted_invalid_numeric_input_blocks_parent_confirm_until_cancelled(page, tmp_path, target, invalid):
    prepare(page)
    sketch_id = create_sketch(page)
    before = save_document(page, tmp_path, 'before-invalid-input.json')
    select_sketch(page, sketch_id)
    panel(page).get_by_role('button', name='Редактировать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    point_id = dialog.locator('[data-sketch-point-id]').first.get_attribute('data-sketch-point-id')
    field = dialog.get_by_label(f'X {point_id}' if target == 'point' else 'Значение width', exact=True)
    original = field.input_value()
    field.fill(invalid)
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    field.blur()
    expect(field).to_have_attribute('aria-invalid', 'true')
    expect(dialog.get_by_text('Введите конечное число', exact=True)).to_be_visible()
    expect(dialog.locator('[data-sketch-editor-valid]')).to_have_attribute('data-sketch-editor-valid', 'false')
    dialog.get_by_role('button', name='Отменить ввод', exact=True).click()
    expect(field).to_have_value(original)
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_enabled()
    field.fill(invalid)
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'after-invalid-input.json') == before
    panel(page).get_by_role('button', name='Редактировать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_enabled()
    dialog.get_by_role('button', name='Отмена', exact=True).click()


def test_rejected_locked_point_move_blocks_confirm_until_failed_input_is_cancelled(page, tmp_path):
    prepare(page)
    sketch_id = create_sketch(page)
    before = save_document(page, tmp_path, 'before-locked-point.json')
    select_sketch(page, sketch_id)
    panel(page).get_by_role('button', name='Редактировать эскиз', exact=True).click()
    dialog = page.get_by_role('dialog', name='Редактор эскиза', exact=True)
    point = dialog.locator('[data-sketch-point-id]').first
    point_id = point.get_attribute('data-sketch-point-id')
    original_x = point.get_attribute('data-sketch-point-x')
    field = dialog.get_by_label(f'X {point_id}', exact=True)
    field.fill(str(float(original_x) + 1))
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    field.press('Enter')
    expect(dialog.locator('[data-sketch-draft-status]')).to_have_attribute('data-sketch-draft-status', 'rejected')
    expect(dialog.get_by_role('alert')).to_contain_text('Изменение не применено')
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    expect(point).to_have_attribute('data-sketch-point-x', original_x)
    dialog.get_by_role('button', name='Отменить неудачное изменение', exact=True).click()
    expect(field).to_have_value(original_x)
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_enabled()
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert save_document(page, tmp_path, 'after-locked-point.json') == before
