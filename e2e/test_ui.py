"""Browser E2E tests. Run with: python -m pytest e2e/test_ui.py -v
Start Vite separately: npm run dev -- --port 5173
Set BENDCORE_URL to override the default URL.
"""
import os
import pytest
from playwright.sync_api import sync_playwright

BASE = os.getenv('BENDCORE_URL', 'http://127.0.0.1:5173')

@pytest.fixture(scope='module')
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, **({'executable_path': os.environ['CHROMIUM_PATH']} if os.getenv('CHROMIUM_PATH') else {}), args=['--no-sandbox', '--disable-dev-shm-usage'])
        yield b
        b.close()

@pytest.fixture
def page(browser):
    context = browser.new_context(viewport={'width': 1440, 'height': 900})
    page = context.new_page()
    unexpected_dialogs = []
    def handle_native_dialog(dialog):
        if dialog.type == 'beforeunload':
            dialog.accept()
        else:
            unexpected_dialogs.append(f'{dialog.type}: {dialog.message}')
            dialog.dismiss()
    page.on('dialog', handle_native_dialog)
    page.goto(BASE, wait_until='domcontentloaded', timeout=15000)
    page.locator('.environment-panel').wait_for(timeout=15000)
    yield page
    context.close()
    assert not unexpected_dialogs, 'Unexpected native dialogs: ' + '; '.join(unexpected_dialogs)

def test_switch_environments_and_contextual_properties(page):
    for key, env in [('1','Модель'),('2','Сборка'),('3','Эскиз'),('4','Чертёж')]:
        page.keyboard.press('Alt+' + key)
        assert page.locator('.environment-panel').get_attribute('aria-label') == 'Параметры среды ' + env
        assert page.locator('.environment-panel .environment-fields').count() == 1

def test_environment_persists_after_reload(page):
    page.keyboard.press('Alt+3')
    assert page.locator('.environment-panel').get_attribute('aria-label') == 'Параметры среды Эскиз'
    page.reload(wait_until='domcontentloaded')
    assert page.locator('.environment-panel').get_attribute('aria-label') == 'Параметры среды Эскиз'

def test_ribbon_keyboard_focus(page):
    page.keyboard.press('Alt+r')
    focused = page.evaluate("document.activeElement && document.activeElement.outerHTML")
    assert focused and ('button' in focused or 'tabindex' in focused)
    page.keyboard.press('ArrowRight')
    assert page.evaluate('document.activeElement !== document.body')

def test_tree_selection_and_properties_focus(page):
    tree = page.locator('[role="tree"]')
    assert tree.count() > 0
    tree.first.focus()
    page.keyboard.press('ArrowDown')
    page.keyboard.press('Enter')
    page.keyboard.press('F4')
    assert page.evaluate("!!document.activeElement?.closest('[data-property-editor]')")

def test_settings_survive_reload(page):
    page.keyboard.press('Alt+2')
    page.reload(wait_until='domcontentloaded')
    assert page.locator('.environment-panel').get_attribute('aria-label') == 'Параметры среды Сборка'
    saved = page.evaluate("JSON.parse(localStorage.getItem('bendcore-ui-v25'))")
    assert saved['tab'] == 'Сборка'

def test_command_search(page):
    page.keyboard.press('Control+k')
    assert page.locator('input:focus').count() > 0
    page.keyboard.press('Escape')
