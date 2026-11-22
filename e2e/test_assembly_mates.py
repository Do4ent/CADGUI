"""Fixed assembly mates in the real OCCT-backed assembly viewport."""

import json
import math

import pytest
from playwright.sync_api import expect

from test_assembly_instances import add_occurrence, instance_marker
from test_drawing import save_document
from test_kernel import create_box, prepare
from test_regression import browser, page


def assert_world_pose(page, occurrence_id, position, rotation_z):
    marker = instance_marker(page, occurrence_id)
    expect(marker).to_be_attached(timeout=120000)
    page.wait_for_function(
        """([id, xyz, degrees]) => {
            const marker = document.querySelector(
                '[data-assembly-instance="' + CSS.escape(id) + '"]'
            );
            const position = JSON.parse(marker?.dataset.assemblyWorldPosition ?? 'null');
            const quaternion = JSON.parse(marker?.dataset.assemblyWorldQuaternion ?? 'null');
            if (position?.length !== 3 || quaternion?.length !== 4) return false;
            const half = degrees * Math.PI / 360;
            const dot = quaternion[2] * Math.sin(half) + quaternion[3] * Math.cos(half);
            return position.every((value, i) => Math.abs(value - xyz[i]) < 1e-7)
                && Math.abs(Math.abs(dot) - 1) < 1e-7;
        }""",
        arg=[occurrence_id, position, rotation_z],
    )
    expected = [0, 0, math.sin(math.radians(rotation_z) / 2), math.cos(math.radians(rotation_z) / 2)]
    quaternion = json.loads(marker.get_attribute('data-assembly-world-quaternion'))
    assert abs(sum(actual * wanted for actual, wanted in zip(quaternion, expected))) == pytest.approx(1)


def test_fixed_mate_tracks_leader_preserves_detached_pose_and_reopens(page, tmp_path):
    prepare(page)
    create_box(page)
    source = save_document(page, tmp_path, 'mate-source.json')['exactModel']
    source_id = source['bodies'][0]['id']
    page.get_by_role('button', name='Сборка', exact=True).click()
    panel = page.get_by_role('region', name='Вхождения деталей', exact=True)
    ribbon = page.get_by_label('Контекстные команды: Сборка', exact=True)
    create_mate = ribbon.get_by_role('button', name='Сопряжение', exact=True)
    expect(create_mate).to_be_disabled()
    add_occurrence(page, source_id, 'Основание', [0, 0, 0], [0, 0, 0])
    add_occurrence(page, source_id, 'Кронштейн', [10, 0, 0], [0, 0, 30])
    before = save_document(page, tmp_path, 'mate-before.json')
    leader, follower = [item['id'] for item in before['assemblyInstances']]
    assert_world_pose(page, follower, [10, 0, 0], 30)

    panel.get_by_role('button', name='Создать сопряжение', exact=True).click()
    dialog = page.get_by_role('dialog', name='Фиксированное сопряжение', exact=True)
    expect(dialog).to_be_visible()
    dialog.get_by_role('button', name='Отмена', exact=True).click()
    create_mate.click()
    dialog = page.get_by_role('dialog', name='Фиксированное сопряжение', exact=True)
    dialog.get_by_label('Ведущее вхождение', exact=True).select_option(leader)
    dialog.get_by_label('Ведомое вхождение', exact=True).select_option(follower)
    dialog.get_by_role('button', name='ОК', exact=True).click()
    expect(dialog).not_to_be_visible()
    expect(create_mate).to_be_disabled()
    assert_world_pose(page, leader, [0, 0, 0], 0)
    assert_world_pose(page, follower, [10, 0, 0], 30)

    leader_row = page.locator(f'[data-assembly-occurrence="{leader}"]')
    leader_row.get_by_role('button', name='Изменить вхождение', exact=True).click()
    edit = page.get_by_role('dialog', name='Вхождение детали', exact=True)
    edit.get_by_label('Смещение X', exact=True).fill('3')
    edit.get_by_label('Поворот Z', exact=True).fill('90')
    edit.get_by_role('button', name='ОК', exact=True).click()
    expect(edit).not_to_be_visible()
    assert_world_pose(page, leader, [3, 0, 0], 90)
    assert_world_pose(page, follower, [3, 10, 0], 120)

    saved = save_document(page, tmp_path, 'mate-linked.json')
    assert saved['schemaVersion'] == 16
    assert saved['exactModel'] == source
    (mate,) = saved['assemblyFixedMates']
    assert (mate['leaderId'], mate['followerId']) == (leader, follower)
    assert mate['translation'] == pytest.approx([10, 0, 0])

    tabs = page.get_by_role('tablist', name='Документы').get_by_role('tab')
    count = tabs.count()
    page.get_by_label('Импорт документа JSON', exact=True).set_input_files(
        str(tmp_path / 'mate-linked.json')
    )
    expect(tabs).to_have_count(count + 1, timeout=120000)
    assert_world_pose(page, follower, [3, 10, 0], 120)
    assert save_document(page, tmp_path, 'mate-reopened.json')['assemblyFixedMates'] == [mate]

    detach = panel.get_by_role('button', name='Отсоединить сопряжение', exact=True)
    detach.click()
    page.get_by_role('dialog', name='Отсоединить сопряжение', exact=True).get_by_role(
        'button', name='ОК', exact=True
    ).click()
    expect(detach).to_have_count(0)
    assert_world_pose(page, follower, [3, 10, 0], 120)
    detached = save_document(page, tmp_path, 'mate-detached.json')
    assert detached.get('assemblyFixedMates', []) == []
    assert next(item for item in detached['assemblyInstances'] if item['id'] == follower)[
        'position'
    ] == pytest.approx([3, 10, 0])

    page.evaluate('document.activeElement?.blur()')
    page.keyboard.press('Control+z')
    expect(detach).to_have_count(1)
    assert_world_pose(page, follower, [3, 10, 0], 120)
    assert save_document(page, tmp_path, 'mate-undo-detach.json')['assemblyFixedMates'] == [mate]
