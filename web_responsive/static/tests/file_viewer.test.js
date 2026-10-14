import {Component, xml} from "@odoo/owl";
import {contains, mountWithCleanup} from "@web/../tests/web_test_helpers";
import {expect, test} from "@odoo/hoot";
import {FileModel} from "@web/core/file_viewer/file_model";
import {FileViewer} from "@web/core/file_viewer/file_viewer";
import {defineMailModels} from "@mail/../tests/mail_test_helpers";

defineMailModels();

for (const aside of [false, true]) {
    test(`file viewer opens with aside chatter ${aside}`, async () => {
        if (aside) {
            class ChatterFixture extends Component {
                static template = xml`<div class="o-mail-Form-chatter o-aside"/>`;
            }
            await mountWithCleanup(ChatterFixture);
        }
        await mountWithCleanup(FileViewer, {
            props: {
                files: [
                    Object.assign(new FileModel(), {
                        id: 1,
                        name: "image.png",
                        mimetype: "image/png",
                    }),
                ],
                startIndex: 0,
            },
        });
        expect(".o-FileViewerContainer").toHaveCount(1);
        if (aside) {
            expect(".o-FileViewerContainer__minimized").toHaveCount(1);
            await contains('[name="maximize"]').click();
            expect(".o-FileViewerContainer__maximized").toHaveCount(1);
            await contains('[name="minimize"]').click();
            expect(".o-FileViewerContainer__minimized").toHaveCount(1);
        } else {
            expect(".o-FileViewerContainer__maximized").toHaveCount(1);
            expect('[name="minimize"]').toHaveCount(0);
        }
    });
}
