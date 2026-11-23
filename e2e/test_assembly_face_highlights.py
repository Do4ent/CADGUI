"""Draft planar mate face highlights follow exact assembly occurrences."""

from playwright.sync_api import expect

from test_assembly_instances import add_occurrence, instance_marker
from test_assembly_viewport_face_pick import click_face
from test_drawing import save_document
from test_kernel import create_box, prepare, rows
from test_regression import browser, page


def test_planar_mate_highlights_remain_scoped_during_viewport_pick(page, tmp_path):
    prepare(page)
    page.get_by_title('Новый документ', exact=True).click()
    create_box(page)
    source = save_document(page, tmp_path, 'face-highlight-source.json')['exactModel']['bodies'][0]
    rows(page).locator('input[type="checkbox"]').uncheck()
    page.get_by_role('button', name='Сборка', exact=True).click()
    page.locator('.multi-view-tools').get_by_role('button', name='4', exact=True).click()
    page.locator('.view-wrap').first.get_by_title('Развернуть / восстановить', exact=True).click()
    view = page.locator('.view-wrap')
    expect(view).to_have_count(1)
    expect(view.locator('.filetab')).to_contain_text('Спереди')
    canvas = view.locator('.viewport canvas').first

    add_occurrence(page, source['id'], 'Ведущая деталь', [-3, 0, 0], [0, 0, 0])
    add_occurrence(page, source['id'], 'Ведомая деталь', [3, 0, 0], [0, 0, 0])
    before = save_document(page, tmp_path, 'face-highlight-before.json')
    leader, follower = (item['id'] for item in before['assemblyInstances'])
    expect(instance_marker(page, leader)).to_be_attached(timeout=120000)
    expect(instance_marker(page, follower)).to_be_attached(timeout=120000)

    launcher = page.get_by_role('region', name='Вхождения деталей', exact=True).get_by_role(
        'button', name='Создать сопряжение', exact=True,
    )
    launcher.click()
    mate_kind = page.get_by_label('Тип сопряжения', exact=True)
    mate_kind.select_option('planar')
    dialog = page.get_by_role('dialog', name='Совмещение плоских граней', exact=True)
    dialog.get_by_label('Ведущее вхождение', exact=True).select_option(leader)
    dialog.get_by_label('Ведомое вхождение', exact=True).select_option(follower)
    leader_face = dialog.get_by_label('Ведущая грань', exact=True)
    follower_face = dialog.get_by_label('Ведомая грань', exact=True)
    expect(leader_face.locator('option[value="5"]')).to_have_count(1, timeout=120000)
    expect(follower_face.locator('option[value="5"]')).to_have_count(1, timeout=120000)

    all_highlights = view.locator('[data-assembly-face-highlight]')
    leader_highlight = all_highlights.and_(view.locator('[data-assembly-face-highlight="leader"]'))
    follower_highlight = all_highlights.and_(view.locator('[data-assembly-face-highlight="follower"]'))
    expect(all_highlights).to_have_count(0)
    leader_face.select_option('5')
    expect(all_highlights).to_have_count(1)
    expect(leader_highlight).to_have_attribute('data-occurrence-id', leader)
    expect(leader_highlight).to_have_attribute('data-face-index', '5')

    pick_follower = dialog.get_by_role('button', name='Выбрать ведомую грань в 3D', exact=True)
    pick_follower.click()
    expect(dialog).not_to_be_visible()
    expect(all_highlights).to_have_count(1)
    expect(leader_highlight).to_have_attribute('data-occurrence-id', leader)
    page.screenshot(path=str(tmp_path / 'leader-highlight-during-pick.png'))
    page.keyboard.press('Escape')
    expect(dialog).to_be_visible()
    expect(leader_face).to_have_value('5')
    expect(all_highlights).to_have_count(1)

    pick_follower.click()
    click_face(page, canvas, [.75, .67, .83, .59, .9], dialog)
    expect(follower_face).to_have_value('5')
    expect(all_highlights).to_have_count(2)
    expect(leader_highlight).to_have_attribute('data-occurrence-id', leader)
    expect(follower_highlight).to_have_attribute('data-occurrence-id', follower)
    expect(follower_highlight).to_have_attribute('data-face-index', '5')

    leader_face.select_option('4')
    expect(leader_highlight).to_have_attribute('data-face-index', '4')
    expect(follower_highlight).to_have_attribute('data-face-index', '5')
    mate_kind.select_option('fixed')
    expect(all_highlights).to_have_count(0)
    mate_kind.select_option('planar')
    expect(leader_face).to_have_value('')
    leader_face.select_option('5')
    expect(all_highlights).to_have_count(1)
    page.keyboard.press('Escape')
    expect(dialog).not_to_be_visible()
    expect(all_highlights).to_have_count(0)

    after = save_document(page, tmp_path, 'face-highlight-after.json')
    assert after['assemblyInstances'] == before['assemblyInstances']
    assert not after.get('assemblyFixedMates')
