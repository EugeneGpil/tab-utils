import assert from "@brillout/assert";
import { migrate_user_presets } from "./migrate_user_presets";

export { migrate_subapp_id };

function migrate_subapp_id() {
  migrate_user_presets((preset) => {
    assert(preset.app_name || preset.subapp_id);
    if (preset.app_name) {
      preset.subapp_id = preset.app_name;
      delete preset.app_name;
      return true;
    }
  });
}
