"""Production recovery banner, durable original-byte archive and real quota failure."""
import json

import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_drawing import save_document
from test_workspace_recovery import (
    PRIMARY, BACKUP, slots, replace_slots, reload_workspace,
    real_two_tab_generation, add_box,
)

ARCHIVE_PREFIX = PRIMARY + '-archive-'


def archives(page):
    return page.evaluate('''prefix => Object.keys(localStorage).filter(k => k.startsWith(prefix))
        .map(key => ({key, raw: localStorage.getItem(key)}))''', ARCHIVE_PREFIX)


def fallback(page, tmp_path):
    backup = real_two_tab_generation(page, tmp_path)
    primary = '{original-corrupt-primary-exact-bytes'
    replace_slots(page, primary, backup)
    reload_workspace(page)
    expect(page.locator('.recovery-banner')).to_contain_text('Вкладки восстановлены из резервной записи')
    expect(page.get_by_role('treeitem')).to_have_count(1)
    assert slots(page) == [primary, backup]
    return primary, backup


def resume(page):
    page.get_by_role('button', name='Возобновить автосохранение', exact=True).click()


def assert_archived_originals(page, primary, backup):
    records = archives(page)
    assert len(records) == 1
    record = json.loads(records[0]['raw'])
    assert record['version'] == 1
    assert record['primary'] == primary
    assert record['backup'] == backup
    assert record['createdAt']
    return records


@pytest.mark.parametrize('theme', ['dark', 'light'])
def test_banner_resume_archives_exact_sources_restarts_autosave_and_preserves_reload(page, tmp_path, theme):
    page.evaluate('theme => localStorage.setItem("bendcore-theme", theme)', theme)
    primary, backup = fallback(page, tmp_path)
    expect(page.locator('.app')).to_have_class('app ' + theme)
    add_box(page)
    expect(page.get_by_role('treeitem')).to_have_count(2)
    assert slots(page) == [primary, backup]
    resume(page)
    expect(page.locator('.recovery-banner')).to_have_count(0)
    original_archives = assert_archived_originals(page, primary, backup)
    current, retained = slots(page)
    assert current == retained
    workspace = json.loads(current)
    assert len(workspace['tabs'][1]['document']['items']) == 2
    expect(page.get_by_role('tablist', name='Документы').get_by_role('tab').nth(1)).to_contain_text('•')
    add_box(page)
    expect(page.get_by_role('treeitem')).to_have_count(3)
    page.wait_for_function('''key => JSON.parse(localStorage.getItem(key)).tabs[1].document.items.length === 3''', arg=PRIMARY)
    assert slots(page)[1] == current
    assert archives(page) == original_archives
    reload_workspace(page)
    expect(page.locator('.recovery-banner')).to_have_count(0)
    expect(page.get_by_role('treeitem')).to_have_count(3)
    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    expect(tabs).to_have_count(2)
    expect(tabs.nth(1)).to_have_attribute('aria-selected', 'true')
    expect(tabs.nth(1)).to_contain_text('•')
    tabs.first.click()
    expect(page.get_by_role('treeitem')).to_have_count(8)
    assert '•' not in tabs.first.inner_text()
    assert archives(page) == original_archives


def test_real_storage_quota_resume_failure_preserves_warning_slots_and_can_retry(page, tmp_path):
    primary, backup = fallback(page, tmp_path)
    # Exhaust the real origin quota, without replacing Storage methods or hook behavior.
    filled = page.evaluate('''() => {
        let index = 0, written = 0;
        for (const size of [262144, 8192, 128, 1]) {
            const chunk = 'q'.repeat(size);
            for (;;) {
                try { localStorage.setItem('qa-quota-' + index, chunk); index++; written += size; }
                catch (error) {
                    if (error.name !== 'QuotaExceededError') throw error;
                    break;
                }
            }
        }
        return written;
    }''')
    assert filled > 0
    resume(page)
    expect(page.locator('.recovery-banner')).to_contain_text('Автосохранение не возобновлено')
    expect(page.locator('.recovery-banner')).to_contain_text('архив')
    expect(page.get_by_role('button', name='Возобновить автосохранение', exact=True)).to_be_visible()
    assert slots(page) == [primary, backup]
    assert archives(page) == []
    add_box(page)
    expect(page.get_by_role('treeitem')).to_have_count(2)
    assert slots(page) == [primary, backup]
    page.evaluate('''() => Object.keys(localStorage).filter(key => key.startsWith('qa-quota-'))
        .forEach(key => localStorage.removeItem(key))''')
    resume(page)
    expect(page.locator('.recovery-banner')).to_have_count(0)
    assert_archived_originals(page, primary, backup)
    reload_workspace(page)
    expect(page.get_by_role('treeitem')).to_have_count(2)
    expect(page.locator('.recovery-banner')).to_have_count(0)
    exported = save_document(page, tmp_path, 'quota-retry-recovered.json')
    assert len(exported['items']) == 2
