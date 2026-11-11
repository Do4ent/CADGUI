"""Real OCCT/WASM browser acceptance; analytic checks are independent of the app."""
import json
import math
import re

import pytest
from playwright.sync_api import expect
from test_regression import browser, page, items
from test_drawing import save_document
from test_workflows import open_box
from test_model_annotations import create_note


def panel(page):
    return page.get_by_role('region', name='Точная геометрия', exact=True)


def prepare(page):
    page.keyboard.press('Alt+1')
    page.locator('.multi-view-tools').get_by_role('button', name='1', exact=True).click()
    expect(panel(page)).to_be_visible()


def rows(page):
    return panel(page).locator('[data-exact-body-row]')


def stats(page):
    volume = panel(page).locator('[data-exact-volume]')
    expect(volume).to_be_visible(timeout=120000)
    return {
        'volume': float(volume.get_attribute('data-exact-volume')),
        'bounds': json.loads(panel(page).locator('[data-exact-bounds]').get_attribute('data-exact-bounds')),
    }


def inspect_first(page):
    rows(page).first.get_by_role('button').click()
    panel(page).get_by_role('button', name='Проверить тело', exact=True).click()
    return stats(page)


def create_box(page, size=(2, 3, 4), origin=(0, 0, 0)):
    count = rows(page).count()
    panel(page).get_by_role('button', name='Создать точный параллелепипед', exact=True).click()
    dialog = page.get_by_role('dialog', name='Точный параллелепипед', exact=True)
    for label, value in zip(['Длина X', 'Ширина Y', 'Высота Z'], size):
        dialog.get_by_label(label, exact=True).fill(str(value))
    for axis, value in zip('XYZ', origin):
        dialog.get_by_label(f'Начало {axis}', exact=True).fill(str(value))
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(rows(page)).to_have_count(count + 1, timeout=120000)
    expect(dialog).not_to_be_visible(timeout=120000)
    return stats(page)


def create_cylinder(page, radius=2, height=5, origin=(0, 0, 0)):
    count = rows(page).count()
    panel(page).get_by_role('button', name='Создать точный цилиндр', exact=True).click()
    dialog = page.get_by_role('dialog', name='Точный цилиндр', exact=True)
    dialog.get_by_label('Радиус', exact=True).fill(str(radius))
    dialog.get_by_label('Высота', exact=True).fill(str(height))
    for axis, value in zip('XYZ', origin):
        dialog.get_by_label(f'Начало {axis}', exact=True).fill(str(value))
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(rows(page)).to_have_count(count + 1, timeout=120000)
    expect(dialog).not_to_be_visible(timeout=120000)
    return stats(page)


def exact(document):
    assert document['schemaVersion'] == 11
    state = document['exactModel']
    assert state['version'] == 1
    assert state['kernel'] == 'occt-wasm'
    assert state['units'] == 'mm'
    for body in state['bodies']:
        assert re.match(r'\s*(?:DBRep_DrawableShape\s*)?CASCADE Topology V\d+', body['brep'])
    return state


def test_actual_box_has_independent_analytic_volume_bounds_and_persisted_brep(page, tmp_path):
    prepare(page)
    before_items = items(page)
    result = create_box(page)
    assert result['volume'] == pytest.approx(24, rel=1e-9)
    assert result['bounds'][0] == pytest.approx([0, 0, 0], abs=1e-6)
    assert result['bounds'][1] == pytest.approx([2, 3, 4], abs=1e-6)
    saved = save_document(page, tmp_path)
    assert len(exact(saved)['bodies']) == 1
    assert saved['items'] == before_items
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    prepare(page)
    assert inspect_first(page)['volume'] == pytest.approx(24, rel=1e-9)


def test_actual_cylinder_uses_occt_mass_properties_and_geometric_bounds(page):
    prepare(page)
    result = create_cylinder(page)
    assert result['volume'] == pytest.approx(20 * math.pi, rel=1e-8)
    assert result['bounds'][0] == pytest.approx([-2, -2, 0], abs=1e-6)
    assert result['bounds'][1] == pytest.approx([2, 2, 5], abs=1e-6)


def test_cancel_and_invalid_kernel_dimensions_leave_document_unchanged(page, tmp_path):
    prepare(page)
    create_box(page)
    before = save_document(page, tmp_path, 'before.json')
    panel(page).get_by_role('button', name='Создать точный параллелепипед', exact=True).click()
    dialog = page.get_by_role('dialog', name='Точный параллелепипед', exact=True)
    dialog.get_by_label('Длина X', exact=True).fill('-1')
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    expect(rows(page)).to_have_count(1)
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    after = save_document(page, tmp_path, 'after.json')
    assert after == before


def test_mixed_legacy_and_kernel_history_keeps_exact_transactions_atomic(page):
    prepare(page)
    original_count = len(items(page))
    legacy = open_box(page)
    legacy.get_by_role('button', name='ОК', exact=True).click()
    page.wait_for_function('(n) => JSON.parse(localStorage.getItem("bendcore-items")).length === n', arg=original_count + 1)
    create_box(page)
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(rows(page)).to_have_count(0)
    assert len(items(page)) == original_count + 1
    page.keyboard.press('Control+z')
    page.wait_for_function('(n) => JSON.parse(localStorage.getItem("bendcore-items")).length === n', arg=original_count)
    page.keyboard.press('Control+y')
    page.wait_for_function('(n) => JSON.parse(localStorage.getItem("bendcore-items")).length === n', arg=original_count + 1)
    page.keyboard.press('Control+y')
    expect(rows(page)).to_have_count(1)
    assert inspect_first(page)['volume'] == pytest.approx(24, rel=1e-9)


def test_schema4_native_roundtrip_preserves_legacy_parts_notes_and_exact_brep(page, tmp_path):
    prepare(page)
    create_note(page, 'Заметка прежнего компонента', 'component', 'gear1')
    create_box(page)
    before = save_document(page, tmp_path, 'native-v4.json')
    assert len(exact(before)['bodies']) == 1
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({
        'name': 'native-v4.json', 'mimeType': 'application/json', 'buffer': json.dumps(before).encode(),
    })
    expect(page.get_by_role('tablist', name='Документы').get_by_role('tab')).to_have_count(2)
    expect(rows(page)).to_have_count(1)
    assert inspect_first(page)['volume'] == pytest.approx(24, rel=1e-9)
    after = save_document(page, tmp_path, 'native-v4-after.json')
    assert exact(after) == exact(before)
    assert after['items'] == before['items']
    assert after['modelAnnotations'] == before['modelAnnotations']
    assert after['drawing'] == before['drawing']


def test_step_roundtrip_preserves_disconnected_multisolid_volume_and_bounds(page, tmp_path):
    prepare(page)
    create_box(page)
    create_cylinder(page, origin=(10, 0, 0))
    operands = exact(save_document(page, tmp_path, 'operands.json'))['bodies']
    assert len(operands) == 2
    panel(page).get_by_role('button', name='Булева операция', exact=True).click()
    dialog = page.get_by_role('dialog', name='Булева операция', exact=True)
    dialog.get_by_label('Тело A', exact=True).select_option(operands[0]['id'])
    dialog.get_by_label('Тело B', exact=True).select_option(operands[1]['id'])
    dialog.get_by_label('Операция', exact=True).select_option('fuse')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    # Disjoint fuse creates one compound body and retains both input bodies.
    expect(rows(page)).to_have_count(3, timeout=120000)
    expect(dialog).not_to_be_visible(timeout=120000)
    result = stats(page)
    assert result['volume'] == pytest.approx(24 + 20 * math.pi, rel=1e-8)
    assert result['bounds'][0] == pytest.approx([0, -2, 0], abs=1e-6)
    assert result['bounds'][1] == pytest.approx([12, 3, 5], abs=1e-6)
    expect(panel(page).locator('[data-exact-solids]')).to_have_attribute('data-exact-solids', '2')
    fused = exact(save_document(page, tmp_path, 'fused.json'))['bodies']
    assert fused[:2] == operands
    with page.expect_download(timeout=120000) as download:
        panel(page).get_by_role('button', name='Экспорт STEP', exact=True).click()
    target = tmp_path / 'two-solids.step'
    download.value.save_as(target)
    step = target.read_text()
    assert 'ISO-10303-21;' in step and 'END-ISO-10303-21;' in step
    page.get_by_title('Новый документ', exact=True).click()
    expect(rows(page)).to_have_count(0)
    panel(page).get_by_role('button', name='Импорт STEP', exact=True).click()
    page.get_by_label('Файл STEP', exact=True).set_input_files(str(target))
    expect(rows(page)).to_have_count(1, timeout=120000)
    imported = stats(page)
    assert imported['volume'] == pytest.approx(result['volume'], rel=1e-8)
    for actual, expected in zip(imported['bounds'], result['bounds']):
        assert actual == pytest.approx(expected, abs=1e-6)
    expect(panel(page).locator('[data-exact-solids]')).to_have_attribute('data-exact-solids', '2')


def test_real_wasm_loading_failure_is_atomic_and_create_can_retry(page):
    # Abort an actual worker asset request; no kernel result is mocked.
    blocked = []
    wasm = re.compile(r'/assets/occt-wasm-[^/]+\.wasm(?:\?.*)?$')
    def abort_wasm(route):
        blocked.append(route.request.url)
        route.abort('failed')
    page.route(wasm, abort_wasm)
    prepare(page)
    original_items = items(page)
    panel(page).get_by_role('button', name='Создать точный параллелепипед', exact=True).click()
    dialog = page.get_by_role('dialog', name='Точный параллелепипед', exact=True)
    for label, value in [('Длина X', '2'), ('Ширина Y', '3'), ('Высота Z', '4')]:
        dialog.get_by_label(label, exact=True).fill(value)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog.get_by_role('alert')).to_be_visible(timeout=120000)
    assert blocked, 'The test must fail a real WASM load, rather than a form check'
    expect(rows(page)).to_have_count(0)
    assert items(page) == original_items
    page.unroute(wasm, abort_wasm)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(rows(page)).to_have_count(1, timeout=120000)
    assert stats(page)['volume'] == pytest.approx(24, rel=1e-9)


def test_invalid_step_reader_result_cannot_overwrite_existing_exact_body(page, tmp_path):
    prepare(page)
    create_box(page)
    before = save_document(page, tmp_path, 'before-invalid-step.json')
    panel(page).get_by_role('button', name='Импорт STEP', exact=True).click()
    page.get_by_label('Файл STEP', exact=True).set_input_files({
        'name': 'invalid.step', 'mimeType': 'application/step',
        'buffer': b'ISO-10303-21;HEADER;ENDSEC;DATA;BROKEN;ENDSEC;END-ISO-10303-21;',
    })
    expect(panel(page).get_by_role('alert')).to_be_visible(timeout=120000)
    expect(rows(page)).to_have_count(1)
    after = save_document(page, tmp_path, 'after-invalid-step.json')
    assert after == before
    assert inspect_first(page)['volume'] == pytest.approx(24, rel=1e-9)


def test_corrupt_native_brep_is_rejected_before_opening_or_changing_tabs(page, tmp_path):
    prepare(page)
    create_box(page)
    before = save_document(page, tmp_path, 'before-corrupt-brep.json')
    bad = json.loads(json.dumps(before))
    bad['exactModel']['bodies'][0]['brep'] = 'CASCADE Topology V3\nThis is not BREP geometry.'
    tabs_before = page.get_by_role('tablist', name='Документы').get_by_role('tab').count()
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({
        'name': 'corrupt-brep.json', 'mimeType': 'application/json',
        'buffer': json.dumps(bad).encode(),
    })
    expect(page.get_by_role('alert').filter(has_text='Ошибка открытия JSON')).to_be_visible(timeout=120000)
    assert page.get_by_role('tablist', name='Документы').get_by_role('tab').count() == tabs_before
    after = save_document(page, tmp_path, 'after-corrupt-brep.json')
    assert after == before
