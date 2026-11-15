"""Source-linked body intersection/difference acceptance against real OCCT."""
import json
import math

import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_drawing import save_document
from test_kernel import prepare, create_box, rows as exact_rows
from test_sketch import panel, create_sketch, extrude, inspect, edit_width
from test_curves import open_curve


def document(page, tmp_path, name='body-booleans.json'):
    result = save_document(page, tmp_path, name)
    assert result['schemaVersion'] == 12
    return result


def cube(page, tmp_path, x=0):
    before = set(exact_rows(page).evaluate_all('(rows)=>rows.map(row=>row.dataset.exactBodyRow)'))
    create_box(page, size=(2, 2, 2), origin=(x, 0, 0))
    return next(b['id'] for b in document(page, tmp_path)['exactModel']['bodies'] if b['id'] not in before)


def open_boolean(page, operation, a, b):
    panel(page).get_by_role('button', name='Пересечь тела' if operation == 'common' else 'Вычесть тела', exact=True).click()
    dialog = page.get_by_role('dialog', name='Пересечение тел' if operation == 'common' else 'Вычитание тел', exact=True)
    dialog.get_by_label('Тело A', exact=True).select_option(a)
    dialog.get_by_label('Тело B', exact=True).select_option(b)
    return dialog


def boolean(page, tmp_path, operation, a, b):
    count = panel(page).locator('[data-body-boolean-id]').count()
    dialog = open_boolean(page, operation, a, b)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    expect(panel(page).locator('[data-body-boolean-id]')).to_have_count(count + 1)
    return document(page, tmp_path)['sketchModel']['bodyBooleans'][-1]


def sketch_cut(page, tmp_path, target, radius, x):
    dialog = open_curve(page, radius=radius)
    for label, value in [('Начало X', x), ('Начало Y', 1), ('Начало Z', 2)]:
        dialog.get_by_label(label, exact=True).fill(str(value))
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    panel(page).get_by_role('button', name='Вырезать по эскизу', exact=True).click()
    dialog = page.get_by_role('dialog', name='Вырезание по эскизу', exact=True)
    dialog.get_by_label('Исходное тело', exact=True).select_option(target)
    dialog.get_by_label('Глубина вырезания', exact=True).fill('-2')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)
    return document(page, tmp_path)['sketchModel']['cuts'][-1]


@pytest.mark.parametrize('operation,minimum,maximum', [
    ('common', [1, 0, 0], [2, 2, 2]), ('cut', [0, 0, 0], [1, 2, 2]),
])
def test_real_overlap_intersection_and_difference_have_independent_volume_four(page, tmp_path, operation, minimum, maximum):
    prepare(page)
    a, b = cube(page, tmp_path), cube(page, tmp_path, x=1)
    feature = boolean(page, tmp_path, operation, a, b)
    assert feature['operation'] == operation
    assert (feature['aBodyId'], feature['bBodyId']) == (a, b)
    assert feature['bodyId'] not in (a, b)
    expect(exact_rows(page)).to_have_count(3)
    result = inspect(page, feature['bodyId'])
    assert result['volume'] == pytest.approx(4, rel=1e-7)
    assert result['bounds'][0] == pytest.approx(minimum, abs=1e-6)
    assert result['bounds'][1] == pytest.approx(maximum, abs=1e-6)
    assert inspect(page, a)['volume'] == pytest.approx(8, rel=1e-7)
    assert inspect(page, b)['volume'] == pytest.approx(8, rel=1e-7)


@pytest.mark.parametrize('operation', ['common', 'cut'])
def test_disjoint_empty_common_and_noop_cut_reject_without_native_mutation(page, tmp_path, operation):
    prepare(page)
    a, b = cube(page, tmp_path), cube(page, tmp_path, x=4)
    before = document(page, tmp_path, 'boolean-noop-before.json')
    dialog = open_boolean(page, operation, a, b)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog.get_by_role('alert')).to_be_visible(timeout=120000)
    expect(panel(page).locator('[data-body-boolean-id]')).to_have_count(0)
    expect(exact_rows(page)).to_have_count(2)
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert document(page, tmp_path, 'boolean-noop-after.json') == before


def test_mixed_extrusion_cut_body_difference_cut_rebuilds_fresh_sources_then_undo(page, tmp_path):
    prepare(page)
    sketch_id = create_sketch(page, width=2, height=2)
    extrude(page, 2)
    base = document(page, tmp_path)['sketchModel']['extrusions'][0]['bodyId']
    first_cut = sketch_cut(page, tmp_path, base, .25, .25)
    b = cube(page, tmp_path, x=1)
    difference = boolean(page, tmp_path, 'cut', first_cut['bodyId'], b)
    last_cut = sketch_cut(page, tmp_path, difference['bodyId'], .1, .75)
    before = document(page, tmp_path, 'body-graph-before.json')
    assert inspect(page, last_cut['bodyId'])['volume'] == pytest.approx(4 - .145 * math.pi, rel=1e-7)
    edit_width(page, sketch_id, 4)
    after = document(page, tmp_path, 'body-graph-after.json')
    for key in ('extrusions', 'cuts', 'bodyBooleans'):
        assert after['sketchModel'][key] == before['sketchModel'][key]
    assert inspect(page, last_cut['bodyId'])['volume'] == pytest.approx(8 - .145 * math.pi, rel=1e-7)
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    undone = document(page, tmp_path, 'body-graph-undone.json')
    assert undone['sketchModel'] == before['sketchModel']
    assert undone['exactModel'] == before['exactModel']


def test_native_reopen_rebuilds_wrong_boolean_cache_and_preserves_source_on_reload(page, tmp_path):
    prepare(page)
    a, b = cube(page, tmp_path), cube(page, tmp_path, x=1)
    feature = boolean(page, tmp_path, 'common', a, b)
    before = document(page, tmp_path, 'body-native-before.json')
    original_model = json.loads(json.dumps(before['sketchModel']))
    next(body for body in before['exactModel']['bodies'] if body['id'] == feature['bodyId'])['brep'] = next(body['brep'] for body in before['exactModel']['bodies'] if body['id'] == a)
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({
        'name': 'body-boolean-wrong-cache.json', 'mimeType': 'application/json', 'buffer': json.dumps(before).encode(),
    })
    expect(page.get_by_role('tablist', name='Документы').get_by_role('tab')).to_have_count(2, timeout=120000)
    assert inspect(page, feature['bodyId'])['volume'] == pytest.approx(4, rel=1e-7)
    assert document(page, tmp_path, 'body-native-rebuilt.json')['sketchModel'] == original_model
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    prepare(page)
    assert inspect(page, feature['bodyId'])['volume'] == pytest.approx(4, rel=1e-7)
    assert document(page, tmp_path, 'body-native-recovered.json')['sketchModel'] == original_model


def test_cancel_and_document_switch_cannot_commit_old_body_boolean_draft(page, tmp_path):
    prepare(page)
    a, b = cube(page, tmp_path), cube(page, tmp_path, x=1)
    before = document(page, tmp_path, 'body-draft-original.json')
    dialog = open_boolean(page, 'common', a, b)
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    assert document(page, tmp_path, 'body-draft-cancelled.json') == before
    # Open a second document first; an active modal intentionally traps pointer
    # focus, so dispatch activation through the real tab button's DOM click.
    page.get_by_title('Новый документ', exact=True).click()
    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    expect(tabs).to_have_count(2)
    tabs.first.click()
    dialog = open_boolean(page, 'common', a, b)
    tabs.nth(1).evaluate('(tab) => tab.click()')
    expect(tabs.nth(1)).to_have_attribute('aria-selected', 'true')
    expect(dialog).not_to_be_visible()
    expect(exact_rows(page)).to_have_count(0)
    tabs.first.click()
    expect(dialog).not_to_be_visible()
    assert document(page, tmp_path, 'body-reactivated-original.json') == before
