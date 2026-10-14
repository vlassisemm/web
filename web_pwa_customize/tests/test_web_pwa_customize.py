# Copyright 2024 Tecnativa - Víctor Martínez
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

import io

from PIL import Image

from odoo import exceptions
from odoo.tests.common import tagged
from odoo.tools import BinaryBytes

from odoo.addons.base.tests.common import HttpCaseWithUserDemo


@tagged("-at_install", "post_install")
class TestWebPwaCustomize(HttpCaseWithUserDemo):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        icp = cls.env["ir.config_parameter"].sudo()
        icp.set_str("pwa.manifest.short_name", "SHORT-NAME")
        icp.set_str("pwa.manifest.background_color", "#2E69B5")
        icp.set_str("pwa.manifest.theme_color", "#2E69B4")

    def test_webmanifest_customize(self):
        response = self.url_open("/web/manifest.webmanifest")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Content-Type"], "application/manifest+json")
        data = response.json()
        self.assertEqual(data["short_name"], "SHORT-NAME")
        self.assertEqual(data["background_color"], "#2E69B5")
        self.assertEqual(data["theme_color"], "#2E69B4")

    def test_pwa_settings_processing(self):
        """Test the settings logic and icon attachment generation"""
        # 1. Test PNG (valid 512x512)
        img = Image.new("RGB", (512, 512), color="red")
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format="PNG")
        icon_base64 = BinaryBytes(img_byte_arr.getvalue())
        config = self.env["res.config.settings"].create(
            {
                "pwa_short_name": "New Name",
                "pwa_icon": icon_base64,
            }
        )
        config.execute()
        self.assertEqual(config.get_values()["pwa_icon"].content, icon_base64.content)
        # Check manifest endpoint with icons
        response = self.url_open("/web/manifest.webmanifest")
        data = response.json()
        self.assertIn("icons", data)
        self.assertEqual(len(data["icons"]), 6)
        for icon in data["icons"]:
            icon_response = self.url_open(icon["src"])
            self.assertEqual(icon_response.status_code, 200)
            self.assertEqual(icon_response.headers["Content-Type"], "image/png")
            with Image.open(io.BytesIO(icon_response.content)) as rendered_icon:
                size = tuple(map(int, icon["sizes"].split("x")))
                self.assertEqual(rendered_icon.size, size)
        self.assertEqual(data["short_name"], "New Name")
        self.assertEqual(data["scope"], "/odoo")
        self.assertEqual(data["start_url"], "/odoo")
        self.assertEqual(data["display"], "standalone")
        # 2. Test SVG (valid)
        svg_content = (
            '<svg width="100" height="100">'
            '<circle cx="50" cy="50" r="40" stroke="green" '
            'stroke-width="4" fill="yellow" />'
            "</svg>"
        )
        svg_base64 = BinaryBytes(svg_content.encode("utf-8"))
        config.write({"pwa_icon": svg_base64})
        config.execute()
        response = self.url_open("/web/manifest.webmanifest")
        data = response.json()
        self.assertEqual(len(data["icons"]), 1)
        self.assertEqual(data["icons"][0]["type"], "image/svg+xml")
        icon_response = self.url_open(data["icons"][0]["src"])
        self.assertEqual(icon_response.status_code, 200)
        self.assertEqual(icon_response.content, svg_content.encode())
        # 3. Test Clearing Icons
        config.write({"pwa_icon": False})
        config.execute()
        attachments = self.env["ir.attachment"].search(
            [("url", "like", "/web_pwa_customize/icon")]
        )
        self.assertEqual(len(attachments), 0)
        # 4. Test PNG too small (< 512x512)
        small_img = Image.new("RGB", (100, 100), color="blue")
        small_img_byte_arr = io.BytesIO()
        small_img.save(small_img_byte_arr, format="PNG")
        small_icon_base64 = BinaryBytes(small_img_byte_arr.getvalue())
        with self.assertRaises(exceptions.UserError):
            config.write({"pwa_icon": small_icon_base64})
            config.execute()
        # 5. Test File too large (> 2 MB)
        large_content = b"0" * (2 * 1024 * 1024 + 1024)  # Slightly over 2MB
        large_base64 = BinaryBytes(large_content)
        with self.assertRaises(exceptions.UserError):
            config.write({"pwa_icon": large_base64})
            config.execute()
        # 6. Test Invalid Image type (gif)
        gif_img = Image.new("RGB", (512, 512), color="green")
        gif_byte_arr = io.BytesIO()
        gif_img.save(gif_byte_arr, format="GIF")
        gif_base64 = BinaryBytes(gif_byte_arr.getvalue())
        with self.assertRaises(exceptions.UserError):
            config.write({"pwa_icon": gif_base64})
            config.execute()

    def test_default_get_colors(self):
        """Test default colors are set in res.config.settings"""
        # Clear ICP to test defaults
        icp = self.env["ir.config_parameter"].sudo()
        icp.set_str("pwa.manifest.background_color", False)
        icp.set_str("pwa.manifest.theme_color", False)

        res = self.env["res.config.settings"].default_get(
            ["pwa_background_color", "pwa_theme_color"]
        )
        self.assertEqual(res.get("pwa_background_color"), "#714B67")
        self.assertEqual(res.get("pwa_theme_color"), "#714B67")

    def test_default_manifest_and_service_worker(self):
        icp = self.env["ir.config_parameter"].sudo()
        for key in ["short_name", "background_color", "theme_color"]:
            icp.set_str(f"pwa.manifest.{key}", False)
        data = self.url_open("/web/manifest.webmanifest").json()
        self.assertEqual(data["short_name"], "Odoo")
        self.assertEqual(data["background_color"], "#714B67")
        self.assertEqual(data["theme_color"], "#714B67")
        self.assertEqual(len(data["icons"]), 2)
        service_worker = self.url_open("/web/service-worker.js")
        self.assertEqual(service_worker.status_code, 200)
        self.assertEqual(service_worker.headers["Service-Worker-Allowed"], "/odoo")
