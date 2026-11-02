"""Document isolation, unsaved-change protection and JSON compatibility."""
import json
import math
from playwright.sync_api import expect
from test_regression import BASE, browser, page, items
from test_workflows import open_box


def tabs(page):
    return page.get_by_role('tablist', name='Документы')


def import_json(page, payload, name='example.json'):
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files({'name': name, 'mimeType': 'application/json', 'buffer': json.dumps(payload).encode()})


def test_tabs_isolate_content_and_undo_history(page):
    original = items(page)
    page.get_by_title('Новый документ', exact=True).click()
    expect(tabs(page).get_by_role('tab')).to_have_count(2)
    expect(page.locator('[role="treeitem"]')).to_have_count(0)
    dialog = open_box(page)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(page.locator('[role="treeitem"]')).to_have_count(1)
    tabs(page).get_by_role('tab').first.click()
    expect(page.locator('[role="treeitem"]')).to_have_count(len(original))
    page.locator('.command-search input').blur()
    page.keyboard.press('Control+z')
    assert items(page) == original
    tabs(page).get_by_role('tab').nth(1).click()
    page.keyboard.press('Control+z')
    expect(page.locator('[role="treeitem"]')).to_have_count(0)


def test_dirty_close_cancel_preserves_document(page):
    page.get_by_title('Новый документ', exact=True).click()
    dialog = open_box(page)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    page.get_by_role('button', name='Закрыть документ Без имени', exact=True).click()
    warning = page.get_by_role('dialog', name='Несохранённые изменения', exact=True)
    expect(warning).to_be_visible()
    warning.get_by_role('button', name='Отмена', exact=True).click()
    expect(tabs(page).get_by_role('tab')).to_have_count(2)
    expect(page.locator('[role="treeitem"]')).to_have_count(1)
    page.get_by_role('button', name='Закрыть документ Без имени', exact=True).click()
    warning.get_by_role('button', name='Закрыть без сохранения', exact=True).click()
    expect(tabs(page).get_by_role('tab')).to_have_count(1)
    expect(page.locator('[role="treeitem"]')).to_have_count(8)


def test_invalid_import_preserves_active_content(page):
    before = items(page)
    count = tabs(page).get_by_role('tab').count()
    import_json(page, {'format': 'bendcore-demo-v1', 'items': [{'id': 'broken', 'name': 'broken'}]})
    expect(page.get_by_role('alert')).to_be_visible()
    assert items(page) == before
    expect(tabs(page).get_by_role('tab')).to_have_count(count)


def test_invalid_property_edit_cannot_corrupt_document_recovery(page):
    dialog = open_box(page)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(page.locator('[role="treeitem"]')).to_have_count(9)
    before = items(page)
    page.get_by_label('Имя компонента', exact=True).fill('')
    expect(page.get_by_role('alert')).to_be_visible()
    assert items(page) == before
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    expect(page.locator('[role="treeitem"]')).to_have_count(9)
    assert items(page) == before
    # Numeric inputs may sanitize overflow to an empty string or zero. Either
    # behavior must leave a persistable scene with finite vectors after editing.
    created_id = before[-1]['id']
    page.locator(f'[role="treeitem"][data-tree-id="{created_id}"]').click()
    numeric = page.locator('[data-property-editor] input[type="number"]').first
    numeric.fill('1e309')
    for item in items(page):
        assert all(isinstance(n, (int, float)) and math.isfinite(n) for n in item['pos'] + item['size'])
    persisted = items(page)
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()
    expect(page.locator('[role="treeitem"]')).to_have_count(9)
    assert items(page) == persisted


def test_legacy_import_export_and_reopen_roundtrip(page, tmp_path):
    legacy_items = items(page)[:2]
    import_json(page, {'format': 'bendcore-demo-v1', 'items': legacy_items}, 'legacy.json')
    expect(tabs(page).get_by_role('tab')).to_have_count(2)
    expect(page.locator('[role="treeitem"]')).to_have_count(2)
    assert items(page) == legacy_items
    with page.expect_download() as download_info:
        page.get_by_title('Сохранить JSON', exact=True).click()
    target = tmp_path / 'roundtrip.json'
    download_info.value.save_as(target)
    saved = json.loads(target.read_text())
    assert saved['schemaVersion'] == 1
    assert saved['items'] == legacy_items
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files(str(target))
    expect(tabs(page).get_by_role('tab')).to_have_count(3)
    expect(page.locator('[role="treeitem"]')).to_have_count(2)
    assert items(page) == legacy_items


def test_dismissing_beforeunload_preserves_dirty_document(browser):
    # Use an independent context so this test explicitly controls the native prompt.
    context = browser.new_context(viewport={'width': 1440, 'height': 900})
    try:
        page = context.new_page()
        page.goto(BASE, wait_until='domcontentloaded')
        page.locator('.environment-panel').wait_for()
        page.get_by_title('Новый документ', exact=True).click()
        dialog = open_box(page)
        dialog.get_by_role('button', name='ОК', exact=True).click()
        expect(page.locator('[role="treeitem"]')).to_have_count(1)
        before = items(page)
        with page.expect_event('dialog') as prompt:
            page.evaluate("setTimeout(() => { window.location.href = 'about:blank'; }, 0)")
        assert prompt.value.type == 'beforeunload'
        prompt.value.dismiss()
        expect(tabs(page).get_by_role('tab')).to_have_count(2)
        expect(page.locator('[role="treeitem"]')).to_have_count(1)
        assert items(page) == before
        assert page.url != 'about:blank'
    finally:
        context.close()
