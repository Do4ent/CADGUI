"""Fixed mates drive world poses across separate parent frames."""

import pytest
from playwright.sync_api import expect

from test_assembly_groups import add_subassembly
from test_assembly_mates import assert_world_pose
from test_drawing import save_document
from test_kernel import create_box, prepare
from test_regression import browser, page


def add_group_occurrence(page, source_id, group_id, name, x, angle):
    panel = page.get_by_role('region', name='Вхождения деталей', exact=True)
    panel.get_by_role('button', name='Добавить вхождение', exact=True).click()
    dialog = page.get_by_role('dialog', name='Вхождение детали', exact=True)
    dialog.get_by_label('Исходное тело', exact=True).select_option(source_id)
    dialog.get_by_label('Имя вхождения', exact=True).fill(name)
    dialog.get_by_label('Родительская подсборка', exact=True).select_option(group_id)
    dialog.get_by_label('Смещение X', exact=True).fill(str(x))
    dialog.get_by_label('Поворот Z', exact=True).fill(str(angle))
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible()
    return panel.locator('[data-assembly-occurrence]').filter(has_text=name).get_attribute(
        'data-assembly-occurrence'
    )


def reposition_group(page, group_id, x, angle):
    row = page.locator(f'[data-assembly-group="{group_id}"]')
    row.get_by_role('button', name='Изменить подсборку', exact=True).click()
    dialog = page.get_by_role('dialog', name='Подсборка', exact=True)
    dialog.get_by_label('Смещение X', exact=True).fill(str(x))
    dialog.get_by_label('Поворот Z', exact=True).fill(str(angle))
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible()


def test_cross_parent_mate_tracks_leader_and_detaches_in_follower_frame(page, tmp_path):
    prepare(page)
    create_box(page)
    source = save_document(page, tmp_path, 'source.json')['exactModel']
    source_id = source['bodies'][0]['id']
    page.get_by_role('button', name='Сборка', exact=True).click()
    leader_group = add_subassembly(page, 'Привод', [10, 20, 3])
    follower_group = add_subassembly(page, 'Рама', [-4, 7, 2])
    leader = add_group_occurrence(page, source_id, leader_group, 'Ведущий вал', 1, 0)
    follower = add_group_occurrence(page, source_id, follower_group, 'Ведомый вал', 2, 30)
    assert_world_pose(page, leader, [10, 21, 3], 90)
    assert_world_pose(page, follower, [-4, 9, 2], 120)

    panel = page.get_by_role('region', name='Вхождения деталей', exact=True)
    create_mate = panel.get_by_role('button', name='Создать сопряжение', exact=True)
    create_mate.click()
    dialog = page.get_by_role('dialog', name='Фиксированное сопряжение', exact=True)
    dialog.get_by_label('Ведущее вхождение', exact=True).select_option(leader)
    dialog.get_by_label('Ведомое вхождение', exact=True).select_option(follower)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible()
    assert_world_pose(page, follower, [-4, 9, 2], 120)
    expect(create_mate).to_be_disabled()

    reposition_group(page, leader_group, 30, 180)
    assert_world_pose(page, leader, [29, 20, 3], 180)
    assert_world_pose(page, follower, [41, 6, 2], 210)
    reposition_group(page, follower_group, 16, -90)
    assert_world_pose(page, follower, [41, 6, 2], 210)

    file_name = 'cross-parent.json'
    saved = save_document(page, tmp_path, file_name)
    assert saved['schemaVersion'] == 20
    assert saved['exactModel'] == source
    (mate,) = saved['assemblyFixedMates']
    assert (mate['leaderId'], mate['followerId']) == (leader, follower)
    assert mate['translation'] == pytest.approx([-12, 14, -1])
    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    tab_count = tabs.count()
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files(str(tmp_path / file_name))
    expect(tabs).to_have_count(tab_count + 1, timeout=120000)
    assert_world_pose(page, follower, [41, 6, 2], 210)

    detach = panel.get_by_role('button', name='Отсоединить сопряжение', exact=True)
    detach.click()
    page.get_by_role('dialog', name='Отсоединить сопряжение', exact=True).get_by_role(
        'button', name='ОК', exact=True
    ).click()
    expect(detach).to_have_count(0)
    assert_world_pose(page, follower, [41, 6, 2], 210)
    detached = save_document(page, tmp_path, 'detached.json')
    assert detached['assemblyFixedMates'] == []
    pose = next(item for item in detached['assemblyInstances'] if item['id'] == follower)
    assert pose['parentId'] == follower_group
    assert pose['position'] == pytest.approx([1, 25, 0], abs=1e-8)
    assert pose['rotation'] == pytest.approx([0, 0, -60], abs=1e-8)

    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(detach).to_have_count(1)
    assert_world_pose(page, follower, [41, 6, 2], 210)
    assert save_document(page, tmp_path, 'undo-detach.json')['assemblyFixedMates'] == [mate]
