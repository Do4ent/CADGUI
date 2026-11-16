"""Unified dependency inspection drives real feature selection without mutation."""
import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_kernel import prepare, panel as exact_panel
from test_sketch import create_sketch, extrude, panel
from test_fusion import box, fuse
from test_drawing import save_document


@pytest.mark.parametrize('theme', ['light', 'dark'])
def test_unified_history_real_roots_relations_keyboard_reload_and_undo(page, tmp_path, theme):
    page.evaluate('(theme) => localStorage.setItem("bendcore-theme", theme)', theme)
    page.reload(wait_until='domcontentloaded')
    prepare(page)
    sketch_id = create_sketch(page, width=2, height=3)
    extrude(page, depth=4)
    source = save_document(page, tmp_path, 'history-source.json')
    extrusion = source['sketchModel']['extrusions'][0]
    static_id = box(page, tmp_path, origin=(1, 0, 0))
    joined = fuse(page, tmp_path, extrusion['bodyId'], static_id)
    before = save_document(page, tmp_path, 'history-before.json')
    tree = page.get_by_role('tree', name='Объекты истории построения', exact=True)
    rows = tree.get_by_role('treeitem')
    expect(rows).to_have_count(4)
    ids = rows.evaluate_all('(rows) => rows.map(row => row.dataset.historyId)')
    assert len(ids) == len(set(ids))
    assert set(ids) == {f'sketch:{sketch_id}', f'extrusion:{extrusion["id"]}',
                        f'body:{static_id}', f'fusion:{joined["id"]}'}
    fusion_row = tree.locator(f'[data-history-id="fusion:{joined["id"]}"]')
    fusion_row.click()
    expect(fusion_row).to_have_attribute('aria-selected', 'true')
    expect(exact_panel(page).locator(f'[data-exact-body-row="{joined["bodyId"]}"]').get_by_role('button')).to_have_attribute('aria-pressed', 'true')
    inspector = page.get_by_label('Зависимости выбранного объекта', exact=True)
    expect(inspector.get_by_role('heading', name='Исходные объекты (3)', exact=True)).to_be_visible()
    expect(inspector.get_by_role('button')).to_have_count(3)
    # Selecting a non-sketch history node must not leave actions bound to the
    # previously selected sketch (or the first-sketch fallback).
    for node_id in [f'body:{static_id}', f'fusion:{joined["id"]}']:
        tree.locator(f'[data-history-id="{node_id}"]').click()
        expect(panel(page).get_by_role('button', name='Редактировать эскиз', exact=True)).to_be_disabled()
        expect(panel(page).get_by_role('button', name='Удалить эскиз и тела', exact=True)).to_be_disabled()
    # The legacy list remains a supported entry point and must clear the
    # unified inspector rather than show a different operation as selected.
    legacy_sketch = panel(page).get_by_role('list', name='Эскизы', exact=True).locator(f'[data-sketch-id="{sketch_id}"] > button')
    legacy_sketch.click()
    expect(tree.locator('[aria-selected="true"]')).to_have_count(0)
    expect(inspector).to_contain_text('Выберите объект истории для просмотра связей.')
    expect(inspector.get_by_role('heading')).to_have_count(0)
    expect(panel(page).get_by_role('button', name='Редактировать эскиз', exact=True)).to_be_enabled()
    expect(panel(page).get_by_role('button', name='Удалить эскиз и тела', exact=True)).to_be_enabled()
    fusion_row.click()
    expect(tree.locator('[tabindex="0"]')).to_have_count(1)
    fusion_row.focus()
    page.keyboard.press('Home')
    expect(rows.first).to_be_focused()
    expect(fusion_row).to_have_attribute('aria-selected', 'true')
    page.keyboard.press('Space')
    expect(rows.first).to_have_attribute('aria-selected', 'true')
    page.keyboard.press('End')
    expect(rows.last).to_be_focused()
    page.keyboard.press('Enter')
    expect(rows.last).to_have_attribute('aria-selected', 'true')
    assert save_document(page, tmp_path, 'history-after-inspection.json') == before
    page.reload(wait_until='domcontentloaded')
    prepare(page)
    expect(rows).to_have_count(4)
    tree.locator(f'[data-history-id="fusion:{joined["id"]}"]').click()
    panel(page).get_by_role('button', name='Удалить объединение и зависимые тела', exact=True).click()
    expect(rows).to_have_count(3)
    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(rows).to_have_count(4)
    restored = save_document(page, tmp_path, 'history-undo.json')
    assert restored['sketchModel'] == before['sketchModel']
    assert restored['exactModel'] == before['exactModel']
