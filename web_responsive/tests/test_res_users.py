# Copyright 2023 Taras Shabaranskyi
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl.html).
from odoo.exceptions import AccessError
from odoo.tests import new_test_user

from odoo.addons.base.tests.common import BaseCommon


class TestResUsers(BaseCommon):
    def test_compute_redirect_home(self):
        record = new_test_user(self.env, login="jeant@mail.com")
        self.assertFalse(record.is_redirect_home)
        action = (
            self.env["ir.actions.act_window"]
            .sudo()
            .create(
                {
                    "name": "Test Action",
                    "type": "ir.actions.act_window",
                    "res_model": record._name,
                }
            )
        )
        record.action_id = action.id
        self.assertFalse(record.is_redirect_home)
        record.action_id = False
        record.is_redirect_home = True
        self.assertTrue(record.is_redirect_home)

    def test_own_apps_menu_preferences(self):
        user = new_test_user(
            self.env, login="apps_preferences", groups="base.group_user"
        )
        user.with_user(user).write(
            {
                "apps_menu_search_type": "fuse",
                "apps_menu_theme": "community",
                "is_redirect_home": True,
            }
        )
        self.assertEqual(user.apps_menu_search_type, "fuse")
        self.assertEqual(user.apps_menu_theme, "community")
        self.assertTrue(user.is_redirect_home)
        other = new_test_user(
            self.env, login="other_preferences", groups="base.group_user"
        )
        with self.assertRaises(AccessError):
            other.with_user(user).write({"apps_menu_theme": "community"})
