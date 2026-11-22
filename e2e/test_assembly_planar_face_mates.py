"""Use exact planar faces to align occurrences in different subassemblies."""

import json
import math

import pytest
from playwright.sync_api import expect

from test_assembly_groups import add_subassembly
from test_assembly_mates import assert_world_pose, instance_marker
from test_cross_parent_assembly_mates import add_group_occurrence, reposition_group
from test_drawing import save_document
from test_kernel import create_box, prepare
from test_regression import browser, page


def world_xy_vector(quaternion, vector):
    """Transform an XY vector by a quaternion whose only rotation is about Z."""
    _, _, z, w = quaternion
    cosine, sine = 1 - 2 * z * z, 2 * z * w
    x, y = vector
    return cosine * x - sine * y, sine * x + cosine * y


def assert_world_planes(page, leader, follower):
    # For a 2 × 3 × 4 box, exact ordinal 1 is x=2, +X and 2 is y=0, -Y.
    # Confirm coplanarity and opposing normals from production viewport poses.
    def world_plane(instance_id, anchor, normal):
        marker = instance_marker(page, instance_id)
        q = json.loads(marker.get_attribute('data-assembly-world-quaternion'))
        position = json.loads(marker.get_attribute('data-assembly-world-position'))
        world_anchor = world_xy_vector(q, anchor)
        return [coord + offset for coord, offset in zip(position, world_anchor)], world_xy_vector(q, normal)

    leader_point, leader_normal = world_plane(leader, (2, 0), (1, 0))
    follower_point, follower_normal = world_plane(follower, (0, 0), (0, -1))
    assert math.dist(leader_normal, [-axis for axis in follower_normal]) == pytest.approx(0, abs=1e-8)
    offset = [b - a for a, b in zip(leader_point, follower_point)]
    assert sum(a * b for a, b in zip(offset, leader_normal)) == pytest.approx(0, abs=1e-8)


def test_planar_face_mate_align_move_reopen_and_detach(page, tmp_path):
    prepare(page)
    create_box(page)
    create_box(page, size=(4, 3, 4))
    source = save_document(page, tmp_path, 'planar-source.json')['exactModel']
    original_body, replacement_body = source['bodies']
    source_id = original_body['id']
    page.get_by_role('button', name='Сборка', exact=True).click()
    leader_group = add_subassembly(page, 'Плита', [10, 20, 3])
    follower_group = add_subassembly(page, 'Опора', [-4, 7, 2])
    leader = add_group_occurrence(page, source_id, leader_group, 'Ведущая деталь', 1, 0)
    follower = add_group_occurrence(page, source_id, follower_group, 'Ведомая деталь', 2, 0)
    assert_world_pose(page, leader, [10, 21, 3], 90)
    assert_world_pose(page, follower, [-4, 9, 2], 90)

    panel = page.get_by_role('region', name='Вхождения деталей', exact=True)
    panel.get_by_role('button', name='Создать сопряжение', exact=True).click()
    dialog = page.get_by_role('dialog', name='Фиксированное сопряжение', exact=True)
    dialog.get_by_label('Тип сопряжения', exact=True).select_option('planar')
    dialog = page.get_by_role('dialog', name='Совмещение плоских граней', exact=True)
    dialog.get_by_label('Ведущее вхождение', exact=True).select_option(leader)
    dialog.get_by_label('Ведомое вхождение', exact=True).select_option(follower)
    leader_face = dialog.get_by_label('Ведущая грань', exact=True)
    follower_face = dialog.get_by_label('Ведомая грань', exact=True)
    confirm = dialog.get_by_role('button', name='ОК', exact=True)
    expect(leader_face.locator('option[value="1"]')).to_have_count(1, timeout=120000)
    expect(follower_face.locator('option[value="2"]')).to_have_count(1, timeout=120000)
    expect(confirm).to_be_disabled()
    leader_face.select_option('1')
    expect(confirm).to_be_disabled()
    follower_face.select_option('2')
    confirm.click()
    expect(dialog).not_to_be_visible(timeout=120000)
    assert_world_pose(page, follower, [-4, 23, 2], 0)
    assert_world_planes(page, leader, follower)

    reposition_group(page, leader_group, 30, 180)
    assert_world_pose(page, leader, [29, 20, 3], 180)
    assert_world_pose(page, follower, [27, 6, 2], 90)
    reposition_group(page, follower_group, 16, -90)
    assert_world_pose(page, follower, [27, 6, 2], 90)
    assert_world_planes(page, leader, follower)

    file_name = 'planar-mate.json'
    saved = save_document(page, tmp_path, file_name)
    assert saved['schemaVersion'] == 22
    assert saved['exactModel'] == source
    (mate,) = saved['assemblyFixedMates']
    assert (mate['leaderId'], mate['followerId']) == (leader, follower)
    for reference, occurrence, face_index in (
        (mate['leaderFace'], leader, 1),
        (mate['followerFace'], follower, 2),
    ):
        assert reference['occurrenceId'] == occurrence
        assert reference['sourceBodyId'] == source_id
        assert reference['faceIndex'] == face_index
    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    tab_count = tabs.count()
    importer = page.get_by_label('Импорт документа JSON', exact=True)
    importer.set_input_files(str(tmp_path / file_name))
    expect(tabs).to_have_count(tab_count + 1, timeout=120000)
    assert_world_pose(page, follower, [27, 6, 2], 90)
    assert_world_planes(page, leader, follower)
    assert save_document(page, tmp_path, 'planar-reopened.json')['assemblyFixedMates'] == [mate]

    detach = panel.get_by_role('button', name='Отсоединить сопряжение', exact=True)
    detach.click()
    page.get_by_role('dialog', name='Отсоединить сопряжение', exact=True).get_by_role(
        'button', name='ОК', exact=True
    ).click()
    expect(detach).to_have_count(0)
    assert_world_pose(page, follower, [27, 6, 2], 90)
    detached = save_document(page, tmp_path, 'planar-detached.json')
    assert detached['assemblyFixedMates'] == []
    pose = next(item for item in detached['assemblyInstances'] if item['id'] == follower)
    assert pose['parentId'] == follower_group
    assert pose['position'] == pytest.approx([1, 11, 0], abs=1e-8)

    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(detach).to_have_count(1)
    assert_world_pose(page, follower, [27, 6, 2], 90)
    assert save_document(page, tmp_path, 'planar-undo.json')['assemblyFixedMates'] == [mate]

    # A valid alternate BREP with the original source ID must never retarget the mate.
    saved['exactModel']['bodies'][0]['brep'] = replacement_body['brep']
    importer.set_input_files({
        'name':'planar-stale.json', 'mimeType':'application/json', 'buffer':json.dumps(saved).encode(),
    })
    expect(page.get_by_role('alert')).to_contain_text('Геометрия плоской грани изменилась')
    expect(tabs).to_have_count(tab_count + 1)
    assert_world_pose(page, follower, [27, 6, 2], 90)
