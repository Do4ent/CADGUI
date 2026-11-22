"""Pick exact planar faces with real clicks on assembly occurrence meshes."""

import re

import pytest
from playwright.sync_api import expect

from test_assembly_instances import add_occurrence, instance_marker
from test_drawing import save_document
from test_kernel import create_box, prepare, rows
from test_regression import browser, page


def click_face(page, canvas, fractions, result):
    # Orthographic fitting animates after mesh readiness. Probe within the
    # intended half of the front view using real clicks until it reports a hit.
    for _ in range(3):
        for fraction in fractions:
            box = canvas.bounding_box()
            assert box
            page.mouse.click(box['x'] + box['width'] * fraction, box['y'] + box['height'] * .5)
            try:
                expect(result).to_be_visible(timeout=500)
                return
            except AssertionError:
                pass
    expect(result).to_be_visible()


def test_pick_planar_mate_faces_from_same_source_occurrences(page, tmp_path):
    prepare(page)
    page.get_by_title('Новый документ', exact=True).click()
    create_box(page)
    source = save_document(page, tmp_path, 'viewport-pick-source.json')['exactModel']['bodies'][0]
    rows(page).locator('input[type="checkbox"]').uncheck()
    page.get_by_role('button', name='Сборка', exact=True).click()
    page.locator('.multi-view-tools').get_by_role('button', name='4', exact=True).click()
    page.locator('.view-wrap').first.get_by_title('Развернуть / восстановить', exact=True).click()
    view = page.locator('.view-wrap')
    expect(view).to_have_count(1)
    expect(view.locator('.filetab')).to_contain_text('Спереди')
    canvas = view.locator('.viewport canvas').first
    expect(canvas).to_be_visible()

    add_occurrence(page, source['id'], 'Слева', [-3, 0, 0], [0, 0, 0])
    add_occurrence(page, source['id'], 'Справа', [3, 0, 0], [0, 0, 0])
    before = save_document(page, tmp_path, 'viewport-pick-before.json')
    leader, follower = (item['id'] for item in before['assemblyInstances'])
    expect(instance_marker(page, leader)).to_be_attached(timeout=120000)
    expect(instance_marker(page, follower)).to_be_attached(timeout=120000)

    page.get_by_role('region', name='Вхождения деталей', exact=True).get_by_role(
        'button', name='Создать сопряжение', exact=True,
    ).click()
    page.get_by_label('Тип сопряжения', exact=True).select_option('planar')
    dialog = page.get_by_role('dialog', name='Совмещение плоских граней', exact=True)
    dialog.get_by_label('Ведущее вхождение', exact=True).select_option(leader)
    dialog.get_by_label('Ведомое вхождение', exact=True).select_option(follower)
    leader_face = dialog.get_by_label('Ведущая грань', exact=True)
    follower_face = dialog.get_by_label('Ведомая грань', exact=True)
    expect(leader_face.locator('option[value="5"]')).to_have_count(1, timeout=120000)
    expect(follower_face.locator('option[value="5"]')).to_have_count(1, timeout=120000)
    pick_leader = dialog.get_by_role('button', name='Выбрать ведущую грань в 3D', exact=True)
    pick_follower = dialog.get_by_role('button', name='Выбрать ведомую грань в 3D', exact=True)
    cancel_pick = page.get_by_role('button', name='Отмена выбора грани', exact=True)
    pick_leader.click()
    expect(dialog).not_to_be_visible()
    expect(cancel_pick).to_be_focused()
    page.keyboard.press('Escape')
    expect(dialog).to_be_visible()
    expect(cancel_pick).not_to_be_visible()
    expect(pick_leader).to_be_focused()
    expect(leader_face).to_have_value('')

    left_half = [.25, .33, .17, .41, .1]
    right_half = [.75, .67, .83, .59, .9]
    pick_leader.click()
    click_face(page, canvas, right_half, page.get_by_text(re.compile('другого вхождения'), exact=False))
    expect(dialog).not_to_be_visible()
    expect(cancel_pick).to_be_visible()

    click_face(page, canvas, left_half, dialog)
    expect(pick_leader).to_be_focused()
    expect(leader_face).to_have_value('5')
    expect(follower_face).to_have_value('')
    expect(dialog.get_by_role('button', name='ОК', exact=True)).to_be_disabled()
    pick_follower.click()
    click_face(page, canvas, right_half, dialog)
    expect(follower_face).to_have_value('5')
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible(timeout=120000)

    saved = save_document(page, tmp_path, 'viewport-pick-mate.json')
    (mate,) = saved['assemblyFixedMates']
    assert mate['leaderFace']['occurrenceId'] == leader
    assert mate['followerFace']['occurrenceId'] == follower
    assert mate['leaderFace']['sourceBodyId'] == mate['followerFace']['sourceBodyId'] == source['id']
    assert mate['leaderFace']['faceIndex'] == mate['followerFace']['faceIndex'] == 5
    # Both clicked +Z faces are at local z=4. The follower rotates to face
    # -Z, so a relative z-translation of 8 brings those planes into contact.
    assert mate['translation'] == pytest.approx([6, 0, 8], abs=1e-7)
    x, y, z, w = mate['quaternion']
    assert 1 - 2 * (x*x + y*y) == pytest.approx(-1, abs=1e-7)
    assert 2 * (x*z + y*w) == pytest.approx(0, abs=1e-7)
    assert 2 * (y*z - x*w) == pytest.approx(0, abs=1e-7)
