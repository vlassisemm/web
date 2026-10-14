# Copyright 2020 initOS GmbH.
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl.html).

from odoo.tests import TransactionCase


class TestIrConfigParameter(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env["ir.config_parameter"].set_str("web_m2x_options.limit", 10)
        cls.env["ir.config_parameter"].set_str("web_m2x_options.create_edit", "True")
        cls.env["ir.config_parameter"].set_str("web_m2x_options.create", "True")

    def test_web_m2x_options_key(self):
        web_m2x_options = self.env["ir.config_parameter"].get_web_m2x_options()
        self.assertIn("web_m2x_options.limit", web_m2x_options)

    def test_web_m2x_options_value(self):
        web_m2x_options = self.env["ir.config_parameter"].get_web_m2x_options()
        self.assertEqual(web_m2x_options["web_m2x_options.limit"], "10")
        self.assertTrue(bool(web_m2x_options["web_m2x_options.create_edit"]))
        self.assertTrue(bool(web_m2x_options["web_m2x_options.create"]))

    def test_only_public_option_keys_are_exposed(self):
        params = self.env["ir.config_parameter"]
        params.set_str("web_m2x_options.open", "False")
        params.set_int("web_m2x_options.field_limit_entries", 5)
        params.set_str("web_m2x_options.secret", "private")
        options = params.get_web_m2x_options()
        self.assertEqual(options["web_m2x_options.open"], "False")
        self.assertEqual(options["web_m2x_options.field_limit_entries"], "5")
        self.assertNotIn("web_m2x_options.secret", options)
