from odoo.tests import HttpCase, tagged

from odoo.addons.web.tests.test_js import unit_test_error_checker


@tagged("post_install", "-at_install")
class TestResponsiveBrowser(HttpCase):
    def test_desktop(self):
        self.browser_js(
            "/web/tests?headless&loglevel=2&preset=desktop&timeout=15000&id=9bc7a3bf",
            "",
            "",
            login="admin",
            timeout=1800,
            success_signal="[HOOT] Test suite succeeded",
            error_checker=unit_test_error_checker,
        )

    def test_mobile(self):
        self.browser_size = "375x667"
        self.touch_enabled = True
        self.browser_js(
            "/web/tests?headless&loglevel=2&preset=mobile&timeout=15000&id=9bc7a3bf",
            "",
            "",
            login="admin",
            timeout=1800,
            success_signal="[HOOT] Test suite succeeded",
            error_checker=unit_test_error_checker,
        )
