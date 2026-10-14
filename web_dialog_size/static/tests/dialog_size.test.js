import {animationFrame, beforeEach, expect, test} from "@odoo/hoot";
import {Component, xml} from "@odoo/owl";
import {assignDialogTestEnv, contains, defineModels, models, mountWithCleanup, onRpc} from "@web/../tests/web_test_helpers";
import {browser} from "@web/core/browser/browser";
import {Dialog} from "@web/core/dialog/dialog";
import "@web_dialog_size/js/web_dialog_size.esm";

class IrConfigParameter extends models.Model {
    _name = "ir.config_parameter";
}
defineModels([IrConfigParameter]);
let defaultMaximize;
beforeEach(() => {
    defaultMaximize = false;
    browser.localStorage.removeItem("odoo.web_dialog_size.value");
    browser.localStorage.removeItem("odoo.web_dialog_size.last_server_value");
    onRpc("ir.config_parameter", "get_web_dialog_size_config", () => ({default_maximize: defaultMaximize}));
});

async function openDialog(size = "lg", fullscreen = false) {
    class Parent extends Component {
        static components = {Dialog};
        static template = xml`<Dialog size="this.size" fullscreen="this.fullscreen">Content</Dialog>`;
        size = size;
        fullscreen = fullscreen;
    }
    assignDialogTestEnv();
    await mountWithCleanup(Parent);
    await animationFrame();
}

for (const size of ["sm", "md", "lg", "xl"]) {
    test(`maximize and restore standard size ${size}`, async () => {
        await openDialog(size);
        expect(`.modal-dialog.modal-${size}`).toHaveCount(1);
        await contains('button[data-icon="expand_content"]').click();
        expect(".modal-dialog.modal-fs").toHaveCount(1);
        expect(browser.localStorage.getItem("odoo.web_dialog_size.value")).toBe("true");
        await contains('button[data-icon="close_fullscreen"]').click();
        expect(`.modal-dialog.modal-${size}`).toHaveCount(1);
        expect(browser.localStorage.getItem("odoo.web_dialog_size.value")).toBe("false");
    });
}

test("server default maximizes first dialog", async () => {
    defaultMaximize = true;
    await openDialog("xl");
    expect(".modal-dialog.modal-fs").toHaveCount(1);
    await contains('button[data-icon="close_fullscreen"]').click();
    expect(".modal-dialog.modal-xl").toHaveCount(1);
});

test("explicit local choice survives reopening", async () => {
    defaultMaximize = true;
    browser.localStorage.setItem("odoo.web_dialog_size.value", "false");
    browser.localStorage.setItem("odoo.web_dialog_size.last_server_value", "true");
    await openDialog();
    expect(".modal-dialog.modal-lg").toHaveCount(1);
});

test("changed server default updates a matching previous choice", async () => {
    browser.localStorage.setItem("odoo.web_dialog_size.value", "true");
    browser.localStorage.setItem("odoo.web_dialog_size.last_server_value", "true");
    await openDialog("md");
    expect(".modal-dialog.modal-md").toHaveCount(1);
});

test("fullscreen dialogs keep native navigation", async () => {
    await openDialog("lg", true);
    expect('button[data-icon="arrow_back"]').toHaveCount(1);
    expect('button[data-icon="expand_content"]').toHaveCount(0);
});
