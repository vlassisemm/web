import {signal} from "@odoo/owl";
import {browser} from "@web/core/browser/browser";
import {Dialog} from "@web/core/dialog/dialog";
import {patch} from "@web/core/utils/patch";
import {useService} from "@web/core/utils/hooks";

function triggerWindowResize() {
    requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
    });
}

patch(Dialog.prototype, {
    setup() {
        super.setup();
        const storedValue = browser.localStorage.getItem("odoo.web_dialog_size.value");
        const lastServerValue = browser.localStorage.getItem(
            "odoo.web_dialog_size.last_server_value"
        );
        // Keep the native size signal available for view arch overrides. The
        // addon only overlays fullscreen, so restoring uses the current size.
        this.webDialogMaximized = signal(storedValue === "true");
        this.webDialogSizeUserToggled = false;
        const orm = useService("orm");
        orm.call("ir.config_parameter", "get_web_dialog_size_config").then((config) => {
            const serverValue = String(Boolean(config.default_maximize));
            if (serverValue !== lastServerValue) {
                browser.localStorage.setItem(
                    "odoo.web_dialog_size.last_server_value",
                    serverValue
                );
                if (
                    !this.webDialogSizeUserToggled &&
                    (storedValue === null || storedValue === lastServerValue)
                ) {
                    browser.localStorage.setItem(
                        "odoo.web_dialog_size.value",
                        serverValue
                    );
                    this.webDialogMaximized.set(serverValue === "true");
                    triggerWindowResize();
                }
            }
        });
    },

    get size() {
        return this.webDialogMaximized?.() ? "fs" : super.size;
    },

    toggleDialogSize() {
        const maximize = !this.webDialogMaximized();
        this.webDialogSizeUserToggled = true;
        this.webDialogMaximized.set(maximize);
        browser.localStorage.setItem("odoo.web_dialog_size.value", String(maximize));
        triggerWindowResize();
    },
});
