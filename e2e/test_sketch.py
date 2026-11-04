"""Sketch sources, actual OCCT extrusion and transactional dependency rebuilds."""
import json

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
    assert document['schemaVersion'] == 5
    state = document['sketchModel']
    assert state['version'] == 1
    assert state['units'] == 'mm'
    return state


def select_sketch(page, sketch_id):
    sketch_rows(page).filter(has=page.locator(f'[data-sketch-id="{sketch_id}"]'))
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
