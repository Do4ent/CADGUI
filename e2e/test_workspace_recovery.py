"""Real storage/reload recovery preserves both generations and pauses autosave."""
import json

import pytest
from playwright.sync_api import expect
from test_regression import browser, page
from test_drawing import save_document
from test_workflows import open_box

PRIMARY = 'bendcore-documents-v1'
BACKUP = PRIMARY + '-backup'


def slots(page):
    return page.evaluate('keys => keys.map(key => localStorage.getItem(key))', [PRIMARY, BACKUP])


def replace_slots(page, primary, backup):
    page.evaluate('''({keys, values}) => keys.forEach((key, i) => {
        if (values[i] === null) localStorage.removeItem(key);
        else localStorage.setItem(key, values[i]);
    })''', {'keys': [PRIMARY, BACKUP], 'values': [primary, backup]})


def reload_workspace(page):
    page.reload(wait_until='domcontentloaded')
    page.locator('.environment-panel').wait_for()


def add_box(page):
    dialog = open_box(page)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible()


def real_two_tab_generation(page, tmp_path):
    # Generate documents and saved fingerprints through the actual application.
    save_document(page, tmp_path, 'clean-original.json')
    page.get_by_title('Новый документ', exact=True).click()
    add_box(page)
    expect(page.get_by_role('treeitem')).to_have_count(1)
    page.wait_for_function('''key => {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value?.tabs.length === 2 && value.tabs[1].document.items.length === 1;
    }''', arg=PRIMARY)
    raw = slots(page)[0]
    payload = json.loads(raw)
    assert payload['activeId'] == payload['tabs'][1]['document']['id']
    assert payload['tabs'][0]['saved'] is not None
    assert payload['tabs'][1]['saved'] is None
    return raw


@pytest.mark.parametrize('primary_kind', ['corrupt-json', 'missing', 'invalid-document'])
def test_backup_fallback_restores_active_dirty_tabs_preserves_raw_slots_and_pauses_autosave(page, tmp_path, primary_kind):
    backup = real_two_tab_generation(page, tmp_path)
    if primary_kind == 'corrupt-json':
        primary = '{broken-primary-preserve-exactly'
    elif primary_kind == 'missing':
        primary = None
    else:
        invalid = json.loads(backup)
        invalid['tabs'][1]['document']['items'] = [{'id': 'malformed-component'}]
        primary = json.dumps(invalid)
    replace_slots(page, primary, backup)
    reload_workspace(page)
    expect(page.get_by_role('alert').filter(has_text='Вкладки восстановлены из резервной записи')).to_be_visible()
    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    expect(tabs).to_have_count(2)
    expect(tabs.nth(1)).to_have_attribute('aria-selected', 'true')
    expect(tabs.nth(1)).to_contain_text('•')
    assert '•' not in tabs.first.inner_text()
    expect(page.get_by_role('treeitem')).to_have_count(1)
    assert slots(page) == [primary, backup]
    # A genuine edit must update the UI while neither raw storage slot changes.
    add_box(page)
    expect(page.get_by_role('treeitem')).to_have_count(2)
    page.wait_for_function('() => document.querySelectorAll("[role=treeitem]").length === 2')
    assert slots(page) == [primary, backup]
    exported = save_document(page, tmp_path, 'recovered-edited-export.json')
    assert len(exported['items']) == 2
    expect(tabs.nth(1)).not_to_contain_text('•')
    assert slots(page) == [primary, backup], 'Export/markSaved must not restart autosave'
    reload_workspace(page)
    expect(page.get_by_role('treeitem')).to_have_count(1)
    expect(tabs.nth(1)).to_contain_text('•')
    tabs.first.click()
    expect(page.get_by_role('treeitem')).to_have_count(8)
    assert '•' not in tabs.first.inner_text()
    assert slots(page) == [primary, backup]


def test_both_damaged_generations_preserve_raw_data_during_fallback_edit_and_reload(page, tmp_path):
    primary, backup = '{primary-truncated', '{backup-truncated'
    replace_slots(page, primary, backup)
    reload_workspace(page)
    expect(page.get_by_role('alert').filter(has_text='Не удалось открыть сохранённые вкладки')).to_be_visible()
    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    expect(tabs).to_have_count(1)
    expect(tabs.first).to_contain_text('Восстановленный документ')
    expect(page.get_by_role('treeitem')).to_have_count(8)
    add_box(page)
    expect(page.get_by_role('treeitem')).to_have_count(9)
    assert slots(page) == [primary, backup]
    exported = save_document(page, tmp_path, 'unrecoverable-session-export.json')
    assert len(exported['items']) == 9
    assert slots(page) == [primary, backup]
    # Both workspace generations remain unavailable. The compatibility scene
    # mirror is independent and provides the fallback's initial components.
    legacy = page.evaluate('JSON.parse(localStorage.getItem("bendcore-items"))')
    assert len(legacy) == 9
    reload_workspace(page)
    expect(page.get_by_role('treeitem')).to_have_count(len(legacy))
    recovered = save_document(page, tmp_path, 'unrecoverable-legacy-fallback.json')
    assert recovered['items'] == legacy
    assert slots(page) == [primary, backup]


def test_valid_primary_wins_over_damaged_backup_and_normal_autosave_rotates_valid_generation(page, tmp_path):
    primary = real_two_tab_generation(page, tmp_path)
    replace_slots(page, primary, '{invalid-backup')
    reload_workspace(page)
    expect(page.get_by_role('alert').filter(has_text='Автоматическое сохранение')).to_have_count(0)
    expect(page.get_by_role('treeitem')).to_have_count(1)
    assert slots(page) == [primary, '{invalid-backup']
    add_box(page)
    expect(page.get_by_role('treeitem')).to_have_count(2)
    page.wait_for_function('''({primaryKey, backupKey, previous}) => {
        const raw = localStorage.getItem(primaryKey);
        return raw !== previous && JSON.parse(raw).tabs[1].document.items.length === 2
            && localStorage.getItem(backupKey) === previous;
    }''', arg={'primaryKey': PRIMARY, 'backupKey': BACKUP, 'previous': primary})
    assert slots(page)[1] == primary
