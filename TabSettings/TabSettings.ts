import assert from "@brillout/assert";
import load_font from "./load_font";
import load_font_list from "./load_font_list";
import set_background from "./set_background";
import "./tab-settings.css";
import { track_event, track_error } from "../views/common/tracker";
import { remove_hash } from "../auto_remove_hash";
import {
  PersistantInput,
  TextInput,
  BooleanInput,
  SelectInput,
  ColorInput,
  DateInput,
  Button,
} from "./PersistantInput";
import { show_toast } from "../views/common/show_toast";
import { run_migrations } from "./run_migrations";

run_migrations();

export class TabSettings {
  preset_concept_name;

  text_container;
  no_random_preset;

  on_any_change;
  on_font_change;

  enable_import_export;
  subapp_id;

  creator_content;
  options_content;
  options_container;
  save_content;
  save_container;
  share_content;
  share_container;

  preset_list;
  option_list;

  resolve_font_loaded_promise;
  font_loaded_promise;

  button_mod: Button;
  button_del: Button;
  name_option: TextOption;
  button_url: Button;

  constructor({
    option_spec_list,
    preset_spec_list,

    text_container = null,
    no_random_preset = false,

    on_any_change,
    on_font_change = null,

    enable_import_export,
    subapp_id,
    preset_concept_name,
  }) {
    assert(preset_concept_name);

    {
      const hasTextFontInput = !!option_spec_list.find(
        ({ option_type }) => option_type === "text-font-input"
      );
      const hasTextShadowInput = !!option_spec_list.find(
        ({ option_type }) => option_type === "text-shadow-input"
      );
      const hasTextColorInput = !!option_spec_list.find(
        ({ option_type }) => option_type === "text-color-input"
      );
      assert(
        (!text_container &&
          !on_font_change &&
          !hasTextFontInput &&
          !hasTextShadowInput &&
          !hasTextColorInput) ||
          (text_container &&
            on_font_change &&
            hasTextFontInput &&
            hasTextShadowInput &&
            hasTextColorInput)
      );
    }

    this.preset_concept_name = preset_concept_name;

    this.text_container = text_container;
    this.no_random_preset = no_random_preset;

    this.on_any_change = on_any_change;
    this.on_font_change = on_font_change;

    this.enable_import_export = enable_import_export;
    this.subapp_id = subapp_id;

    this.creator_content = document.getElementById("creator-content");
    this.options_content = document.getElementById("options-content");
    this.options_container = document.getElementById("options-container");
    this.save_content = document.getElementById("save-content");
    this.save_container = document.getElementById("save-container");
    this.share_content = document.getElementById("share-content");
    this.share_container = document.getElementById("share-container");

    this.preset_list = new PresetList({ preset_spec_list, tab_settings: this });
    this.option_list = instantiate_options({
      tab_settings: this,
      option_spec_list,
    });

    this.resolve_font_loaded_promise;
    this.font_loaded_promise = new Promise(
      (r) => (this.resolve_font_loaded_promise = r)
    );
  }

  generate_dom() {
    this.option_list.forEach((opt) => {
      opt.generate_dom();
    });

    if (this.enable_import_export) {
      this.generate_import_export_dom();
    }

    this.global_side_effects({ is_initial_run: true });
  }

  generate_import_export_dom() {
    let input_container = this.creator_content;
    {
      const btn = new Button({
        input_container,
        text: "Customize",
        className: "action-button",
        on_click: () => {
          this.modify_preset();
        },
        id: "modify-preset-button",
      });
      btn.generate_dom();
      this.button_mod = btn;
    }
    {
      const btn = new Button({
        input_container,
        text: "Delete",
        className: "action-button",
        on_click: () => {
          this.delete_preset();
        },
        id: "delete-preset-button",
      });
      btn.generate_dom();
      this.button_del = btn;
    }

    input_container = this.save_content;
    {
      const { subapp_id } = this;
      assert(subapp_id);
      const name_option = new TextOption({
        input_container,
        option_id: subapp_id + "_name",
        input_width: "150px",
        option_description: this.preset_concept_name + " name",
        option_default: "",
        tab_settings: this,
        id: "preset-name-input",
      });
      name_option.generate_dom();
      this.name_option = name_option;
    }

    {
      const btn = new Button({
        input_container,
        text: "Save",
        on_click: () => {
          this.save_created_preset();
        },
        id: "save-preset-button",
      });
      btn.generate_dom();
      this.button_url = btn;
    }
  }

  save_created_preset() {
    assert(this.preset_selected.is_creator_preset);

    const preset_name = this.name_option.input_value;
    if (!preset_name) {
      alert(
        "You need to provide a name for your " +
          this.preset_concept_name +
          " in order to save it."
      );
      return;
    }
    const preset_id = NameIdConverter.from_name_to_id(preset_name);

    if (this.preset_list.get_preset_by_name(preset_id, { can_be_null: true })) {
      const error_msg =
        "Change the name of your " +
        this.preset_concept_name +
        "; " +
        "you already have a " +
        this.preset_concept_name +
        ' saved with ID "' +
        preset_id +
        '". (IDs are genrated from name; change name to change ID.)';
      alert(error_msg);
      return;
    }

    const preset_values = {};
    this.option_list
      .filter((option) => option.is_creator_option)
      .forEach((option) => {
        const preset_val = option.input_value;
        assert(
          [false, ""].includes(preset_val) || preset_val,
          option.option_id,
          preset_val === undefined,
          { preset_val }
        );
        preset_values[option.option_id] = preset_val;
      });

    const new_preset = new SavedPreset({
      preset_id,
      preset_values,
      tab_settings: this,
    });

    this.preset_list.save_preset(new_preset);
    this.select_preset(new_preset);
    this.reset_creator();
  }
  reset_creator() {
    // Erase all custom option values
    this.option_list.forEach((option) => {
      option.reset();
    });
  }

  copy_to_creator() {
    const preset = this.active_preset;
    assert(preset.is_real_preset);

    const { preset_values } = preset;
    for (let opt_id in preset_values) {
      const opt_val = preset_values[opt_id];
      assert(!["preset_name", "preset_id", "id", "name"].includes(opt_val));
      this.find_option((option) => option.option_id === opt_id).set_input_value(
        opt_val
      );
    }
    this.select_preset_creator();
  }

  modify_preset() {
    const preset = this.active_preset;
    assert(preset.is_real_preset);
    const new_preset_id = this.preset_list.generate_unique_preset_id_copy(
      preset
    );
    this.copy_to_creator();
    this.name_option.set_input_value(
      NameIdConverter.from_id_to_name(new_preset_id)
    );
  }

  delete_preset() {
    const preset = this.active_preset;
    assert(preset.is_saved_preset);

    this.copy_to_creator();

    this.name_option.set_input_value(preset.preset_name);

    this.preset_list.remove_preset(preset);
  }

  #global_side_effects__timeout = null;
  global_side_effects({ is_initial_run = false } = {}) {
    if (is_initial_run) {
      this.run_side_effects(true);
      return;
    }
    if (this.#global_side_effects__timeout) {
      return;
    }
    this.#global_side_effects__timeout = requestAnimationFrame(() => {
      this.run_side_effects();
      this.#global_side_effects__timeout = null;
    });
  }
  run_side_effects(is_initial_run = false) {
    this.update_background();
    if (this.text_container) {
      this.update_font();
      this.load_font_list();
    }
    this.update_option_visibility();
    this.update_button_visibility();
    this.on_any_change({ is_initial_run });
    this.update_share_link();
    this.update_save_block();
    if (is_initial_run) {
      this.load_preset_from_url();
      window.addEventListener("hashchange", () => this.load_preset_from_url(), {
        passive: true,
      });
      this.track_user_presets();
      this.set_options_container_visibility();
    }
  }

  set_options_container_visibility() {
    const to_hide = this.option_list.every((opt) => {
      assert(opt.is_creator_option.constructor === Boolean);
      return opt.is_creator_option || opt.is_preset_selector;
    });
    if (to_hide) {
      this.options_container.style.display = "none";
    }
  }

  track_user_presets() {
    track_event({
      eventCategory: "global_stats",
      eventAction: "preset_used",
      eventLabel:
        this.preset_selected.preset_id +
        " " +
        this.preset_concept_name.toLowerCase(),
    });
  }

  #previous_link = null;
  #link_el = null;
  update_share_link() {
    const { preset_selected } = this;
    if (!preset_selected.is_saved_preset) {
      this.share_container.classList.add("no-share-link");
      return;
    } else {
      this.share_container.classList.remove("no-share-link");
    }

    const current_link = preset_selected.share_link;
    if (this.#previous_link === current_link) {
      return;
    } else {
      this.#previous_link = current_link;
    }

    if (!this.#link_el) {
      this.#link_el = document.createElement("a");
      this.#link_el.id = "share-link-tag";
      // this.#link_el.setAttribute('target', '_blank');
      this.share_content.appendChild(this.#link_el);
    }

    this.#link_el.setAttribute("href", current_link);
    this.#link_el.textContent = current_link;
  }

  update_save_block() {
    this.save_container.style.display = this.preset_selected.is_creator_preset
      ? ""
      : "none";
  }

  load_preset_from_url() {
    const preset_url = window.location.href;

    const preset_data: PresetData = LinkSerializer.from_url();

    if (preset_data === null) {
      return;
    }

    const { preset_id } = preset_data;
    assert(preset_id);
    const preset_conflict = this.preset_list.get_preset_by_name(preset_id, {
      can_be_null: true,
    });
    if (preset_conflict) {
      this.select_preset(preset_conflict);
      show_toast(
        this.preset_concept_name +
          ' "' +
          preset_conflict.preset_name +
          '" already saved.'
      );
      remove_hash();
      return;
    }

    const { subapp_id } = preset_data;
    assert(subapp_id);

    /* TN2
    const wrong_url_format =
    if( wrong_url_format ){
      alert("URL is incorrect, maybe you inadvertently modified the URL?");
    }
    */

    const wrong_app = subapp_id !== this.subapp_id;
    if (wrong_app) {
      alert("Wrong app: the URL hash should be loaded in a different app.");
      return;
    }

    const { preset_values } = preset_data;
    assert(preset_values);

    const new_preset = new SavedPreset({
      preset_id,
      preset_values,
      tab_settings: this,
    });

    this.preset_list.save_preset(new_preset);

    this.select_preset(new_preset);

    show_toast(
      this.preset_concept_name +
        ' "' +
        new_preset.preset_name +
        '" successfully saved.'
    );

    remove_hash();

    track_event({
      eventCategory: "preset_imported",
      eventAction: this.preset_concept_name + " " + new_preset.preset_name,
      eventLabel: preset_url,
    });
  }

  update_background() {
    const image = this.current_backgroud_image;
    const color = this.current_backgroud_color;
    set_background(image || color);
  }
  async update_font() {
    const { text_container } = this;
    const get_font_name = () => this.current_font_name;
    await load_text_font({ text_container, get_font_name });
    this.on_font_change();
    this.resolve_font_loaded_promise();
  }
  update_option_visibility() {
    // Visibility of options
    const get_input_val = (dep_option_id) =>
      this.find_option((option) => option.option_id === dep_option_id)
        .input_value;
    this.option_list.forEach((opt) => {
      const to_hide =
        (opt.option_dependency && !get_input_val(opt.option_dependency)) ||
        (opt.is_creator_option && !this.preset_selected.is_creator_preset);
      if (to_hide) {
        opt.hide();
      } else {
        opt.show();
      }
    });
  }
  update_button_visibility() {
    if (!this.enable_import_export) {
      return;
    }
    if (this.preset_selected.is_saved_preset) {
      this.button_del.show();
    } else {
      this.button_del.hide();
    }
    if (this.preset_selected.is_creator_preset) {
      this.button_mod.hide();
      this.button_url.show();
      this.name_option.show();
      // this.button_del.hide();
    } else {
      this.button_url.hide();
      this.name_option.hide();
      // this.button_del.hide();
      if (!this.preset_selected.is_randomizer_preset) {
        this.button_mod.show();
      } else {
        this.button_mod.hide();
      }
    }
  }
  #font_list_already_loading = false;
  async load_font_list() {
    if (!this.preset_selected.is_creator_preset) {
      return;
    }
    if (this.#font_list_already_loading) {
      return;
    }
    this.#font_list_already_loading = true;
    this.font_option.add_fonts([
      SelectInput.get_divider(),
      ...(await load_font_list()),
    ]);
  }

  find_option(match) {
    const option = this.option_list.find(match);
    assert(option);
    return option;
  }

  get background_image_option() {
    return this.find_option((option) => option.is_background_image_option);
  }
  get current_backgroud_image() {
    return this.background_image_option.active_value;
  }

  get background_color_option() {
    return this.find_option((option) => option.is_background_color_option);
  }
  get current_backgroud_color() {
    return this.background_color_option.active_value;
  }

  get font_option() {
    return this.find_option((option) => option.is_font_option);
  }
  get current_font_name() {
    return this.font_option.active_value;
  }

  get active_preset() {
    let active_preset;

    const { preset_selected } = this;
    if (preset_selected.is_randomizer_preset) {
      active_preset = preset_selected.random_preset;
    } else {
      active_preset = preset_selected;
    }

    assert(!active_preset.is_randomizer_preset);
    assert(active_preset.preset_id);

    return active_preset;
  }
  set active_preset(preset_thing) {
    let preset_id;
    if (preset_thing.constructor === String) {
      preset_id = preset_thing;
    }
    if (preset_thing instanceof Preset || preset_thing instanceof FakePreset) {
      preset_id = preset_thing.preset_id;
    }
    assert(preset_id, { preset_thing, preset_id });
    this.preset_option.set_input_value(preset_id);
  }
  select_preset_creator() {
    this.active_preset = this.preset_list.creator_preset;
  }
  select_preset(preset) {
    this.active_preset = preset;
  }

  get preset_selected() {
    const preset_id = this.preset_option.input_value;
    const preset = this.preset_list.get_preset_by_name(preset_id);
    return preset;
  }
  get preset_option() {
    return this.find_option((option) => option.is_preset_selector);
  }

  get_option_value(option_id) {
    return this.find_option((option) => option.option_id === option_id)
      .active_value;
  }
}

interface Option {
  before_dom?(): void;
}
class Option {
  tab_settings: TabSettings;
  option_id: string;
  option_description: string;
  input_args: any;
  is_creator_option: Boolean;
  user_input: PersistantInput;
  constructor({
    option_id,
    option_description,
    option_default,
    input_width,
    tab_settings,
    input_container,
    is_creator_option = false,
    ...props
  }) {
    assert(option_id);
    assert(option_description);
    assert(tab_settings);
    Object.assign(this, {
      option_id,
      tab_settings,
      ...props,
    });

    this.is_creator_option = is_creator_option;

    input_container =
      input_container ||
      (is_creator_option
        ? this.tab_settings.creator_content
        : this.tab_settings.options_content);
    assert(input_container, { option_id });

    this.input_args = {
      input_id: option_id,
      input_description: option_description,
      on_input_change: () => {
        this.tab_settings.global_side_effects();
      },
      input_default: option_default,
      input_container,
      input_width,
    };
  }

  generate_dom() {
    if (this.before_dom) {
      this.before_dom();
    }
    assert(this.user_input);
    this.user_input.init();
  }

  get input_value() {
    return this.user_input.input_get();
  }
  get preset_value() {
    const preset_val = this.tab_settings.active_preset.get_preset_value(this);
    return preset_val;
  }
  get active_value() {
    if (this.tab_settings.preset_selected.is_creator_preset) {
      return this.input_value;
    }
    const { preset_value } = this;
    if (this.is_creator_option) {
      return preset_value;
    }
    if (preset_value !== null) {
      return preset_value;
    }
    return this.input_value;
  }

  set_input_value(val) {
    this.user_input.input_set(val);
  }

  hide() {
    this.user_input.hide();
  }
  show() {
    this.user_input.show();
  }

  reset() {
    // TODO
  }
}

class DateOption extends Option {
  constructor(args) {
    super(args);
    this.user_input = new DateInput(this.input_args);
  }
}

class BooleanOption extends Option {
  constructor(args) {
    super(args);
    this.user_input = new BooleanInput(this.input_args);
  }
}

class SelectOption extends Option {
  user_input: SelectInput;
  constructor(args, input_options: string[]) {
    super(args);
    this.user_input = new SelectInput({ input_options, ...this.input_args });
  }

  add_options(args) {
    this.user_input.add_options(args);
  }
}

class ChoiceOption extends SelectOption {
  constructor({ option_choices, ...args }) {
    super({ input_width: "100px", ...args }, option_choices);
  }
}

class TextOption extends Option {
  constructor(args) {
    super(args);
    this.input_args.input_placeholder = args.option_placeholder;
    this.user_input = new TextInput(this.input_args);
  }
}
/*
class TextOption extends Option {
  constructor({option_placeholder, ...args}) {
    super(args);
    this.input_args.input_placeholder = option_placeholder;
    this.user_input = new TextInput(this.input_args);
  }
}
*/

class ColorOption extends Option {
  constructor(args) {
    super({ input_width: "35px", ...args });
    this.user_input = new ColorInput(this.input_args);
  }
}
class TextColorOption extends ColorOption {
  /*
  local_side_effects() {
    this.tab_settings.text_container.style.color = this.active_value;
  }
  */
}
class TextShadowOption extends TextOption {
  /*
  local_side_effects() {
    this.tab_settings.text_container.style.textShadow = this.active_value;
  }
  */
}

class PresetOption extends SelectOption {
  is_preset_selector = true;
  constructor({ input_options, ...args }) {
    super(
      {
        input_width: "93px",
        input_container: args.tab_settings.creator_content,
        ...args,
      },
      input_options
    );
  }

  before_dom() {
    this.user_input.input_options = this.get_input_options();
  }

  refresh() {
    this.before_dom();
    this.user_input.refresh();
  }

  get_input_options() {
    let {
      special_ones,
      saved_ones,
      native_ones,
    } = this.tab_settings.preset_list.presets_ordered;

    {
      const map = ({ preset_id, preset_name }) => {
        assert(preset_id);
        assert(preset_name);
        return { val: preset_id, val_pretty: preset_name };
      };
      special_ones = special_ones.map(map);
      saved_ones = saved_ones.map(map);
      native_ones = native_ones.map(map);
    }

    return saved_ones.length > 0
      ? [
          ...special_ones,
          SelectInput.get_divider("Saved"),
          ...saved_ones,
          SelectInput.get_divider("Native"),
          ...native_ones,
        ]
      : [...special_ones, SelectInput.get_divider(), ...native_ones];
  }
}

class BackgroundImageOption extends TextOption {
  is_background_image_option = true;
}
class BackgroundColorOption extends ColorOption {
  is_background_color_option = true;
}

class FontOption extends SelectOption {
  is_font_option = true;
  constructor({ input_optoins, ...args }) {
    super({ input_width: "110px", ...args }, input_optoins);
  }

  before_dom() {
    this.user_input.input_options = this.tab_settings.preset_list.get_all_preset_fonts();
  }

  get input_value() {
    const val = super.input_value;
    assert(val, { val });
    return val;
  }
  add_fonts(args) {
    this.add_options(args);
  }
}

async function load_text_font({ text_container, get_font_name }) {
  const font_name = get_font_name();

  await load_font(font_name);

  if (font_name !== get_font_name()) {
    return;
  }

  if (font_name === text_container.style.fontFamily) {
    return;
  }

  text_container.style.fontFamily = font_name;
}

function instantiate_options({ tab_settings, option_spec_list }) {
  return option_spec_list.map(({ option_type, ...option_spec }) => {
    assert(option_spec.option_id, option_spec);
    const args: any = {
      ...option_spec,
      tab_settings,
    };
    if (option_type === "text-font-input") {
      return new FontOption(args);
    }
    if (option_type === "preset-input") {
      return new PresetOption(args);
    }
    if (option_type === "text-color-input") {
      return new TextColorOption(args);
    }
    if (option_type === "color-input") {
      return new ColorOption(args);
    }
    if (option_type === "text-shadow-input") {
      return new TextShadowOption(args);
    }
    if (option_type === "text-input") {
      return new TextOption(args);
    }
    if (option_type === "background-image-input") {
      return new BackgroundImageOption(args);
    }
    if (option_type === "background-color-input") {
      return new BackgroundColorOption(args);
    }
    if (option_type === "boolean-input") {
      return new BooleanOption(args);
    }
    if (option_type === "date-input") {
      return new DateOption(args);
    }
    if (option_type === "choice-input") {
      return new ChoiceOption(args);
    }
    assert(false, { option_type });
  });
}

class PresetList {
  #preset_savior = null;
  #native_presets = null;
  tab_settings: TabSettings;
  randomizer_preset: RandomizerPreset;
  creator_preset: CreatorPreset;

  constructor({ preset_spec_list, tab_settings }) {
    this.tab_settings = tab_settings;

    this.#preset_savior = new PresetSavior({
      subapp_id: tab_settings.subapp_id,
    });

    if (!this.tab_settings.no_random_preset) {
      this.randomizer_preset = new RandomizerPreset({ preset_list: this });
    }
    this.creator_preset = new CreatorPreset();

    this.#native_presets = Object.entries(preset_spec_list).map(
      ([preset_id, preset_values]) =>
        new NativePreset({ preset_id, preset_values, tab_settings })
    );
  }

  save_preset(preset) {
    this.#preset_savior.save_preset(preset);
    this.refresh_user_input();
  }
  remove_preset(preset) {
    this.#preset_savior.remove_preset(preset);
    this.refresh_user_input();
  }

  refresh_user_input() {
    this.tab_settings.preset_option.refresh();
  }

  get random_candidates() {
    const { saved_ones, native_ones } = this.presets_ordered;
    if (saved_ones.length > 1) {
      return saved_ones;
    }
    return native_ones;
  }
  _get_saved_presets() {
    const { tab_settings } = this;
    return this.#preset_savior
      .get_saved_presets()
      .map(
        ({ preset_id, preset_values }) =>
          new SavedPreset({ preset_id, preset_values, tab_settings })
      );
  }
  get presets_ordered() {
    const special_ones = [this.creator_preset];
    if (this.randomizer_preset) {
      special_ones.push(this.randomizer_preset);
    }

    const saved_ones = this._get_saved_presets();

    const native_ones = this.#native_presets;

    assert(special_ones && saved_ones && native_ones);
    return { special_ones, saved_ones, native_ones };
  }
  get_preset_by_name(preset_id, { can_be_null = false } = {}) {
    assert(preset_id);
    const presets = this._get_all_presets();
    for (let preset of presets) {
      if (preset.preset_id === preset_id) {
        return preset;
      }
    }
    assert(can_be_null, { preset_id });
  }
  get_all_preset_fonts() {
    const { saved_ones, native_ones } = this.presets_ordered;
    const presets = [...saved_ones, ...native_ones];

    presets.forEach((preset) =>
      assert(preset.is_real_preset, preset.preset_id)
    );

    let preset_font_names = presets.map((preset) => {
      const font_name = preset.preset_font_name;
      assert(font_name, preset.preset_id);
      return font_name;
    });
    preset_font_names = make_unique(preset_font_names);
    return preset_font_names;
  }

  generate_unique_preset_id_copy(preset) {
    const preset_ids = this._get_all_preset_ids();
    const { preset_id } = preset;
    assert(preset_id);
    const s = NameIdConverter.white_space_seralized;
    assert(s);
    const base =
      preset_id
        .split("_")
        .join(s)
        .split(/-edit(-|$)/)[0] +
      s +
      "edit";
    for (let i = 1; i < 100; i++) {
      const candidate = base + (i === 1 ? "" : s + i);
      if (!preset_ids.includes(candidate)) {
        return candidate;
      }
    }
    assert(false);
  }

  _get_all_preset_ids() {
    const presets = this._get_all_presets();
    const preset_ids = presets.map((preset) => preset.preset_id);
    return preset_ids;
  }

  _get_all_presets() {
    const { special_ones, saved_ones, native_ones } = this.presets_ordered;
    const presets = [...special_ones, ...saved_ones, ...native_ones];
    return presets;
  }
}

class PresetSerializer {
  static serialize_single(preset) {
    assert(preset instanceof SavedPreset);

    // Validation
    const { preset_id, preset_values } = preset;
    const { subapp_id } = preset.tab_settings;
    const preset_data = new PresetData({ preset_id, preset_values, subapp_id });

    const preset_string = JSON.stringify(preset_data);

    return preset_string;
  }

  static deserialize_single(preset_string) {
    assert(preset_string.constructor === String);

    const preset_info = JSON.parse(preset_string);

    // Validation
    const preset_data = new PresetData(preset_info);

    return preset_data;
  }
  static serialize_list(presets) {
    // Validation
    assert(presets.constructor === Array);
    presets.forEach((preset_data) => {
      assert(preset_data instanceof PresetData);
    });

    const presets__string = JSON.stringify(presets);
    return presets__string;
  }

  static deserialize_list(presets_string) {
    let presets = JSON.parse(presets_string || JSON.stringify([]));

    // Validation
    assert(presets.constructor === Array);
    presets = presets.map((preset_data) => new PresetData(preset_data));

    return presets;
  }
}

class Preset {
  preset_id: string;
  preset_values: Object;
  tab_settings: TabSettings;

  is_randomizer_preset: boolean = false;
  is_creator_preset: boolean = false;

  constructor({ preset_id, preset_values, tab_settings }) {
    assert(preset_id);
    assert([Object, PresetValues].includes(preset_values.constructor));
    assert(tab_settings);
    this.preset_id = preset_id;
    this.preset_values = preset_values;
    this.tab_settings = tab_settings;

    // Abstract class
    if (new.target === Preset) {
      throw new TypeError("Cannot construct Preset instances directly.");
    }
  }
  get_preset_value(option) {
    const { option_id } = option;
    assert(option_id);
    const { preset_values } = this;
    if (option_id in preset_values) {
      const val = preset_values[option_id];
      assert(val !== null);
      return val;
    }
    return null;
  }
  get is_real_preset() {
    return !this.is_randomizer_preset && !this.is_creator_preset;
  }
  get preset_font_name() {
    const preset_font_name = this.get_preset_value(
      this.tab_settings.font_option
    );
    assert(preset_font_name);
    return preset_font_name;
  }
  get preset_name() {
    const prettified = NameIdConverter.from_id_to_name(this.preset_id);
    assert(prettified);
    return prettified;
  }
}

class SavedPreset extends Preset {
  get is_saved_preset() {
    return true;
  }
  #generated_link = null;
  get share_link() {
    if (!this.#generated_link) {
      return (this.#generated_link = LinkSerializer.to_url(this));
    }
    return this.#generated_link;
  }
}

class NativePreset extends Preset {
  constructor(args) {
    super(args);
    const { preset_id } = args;
    assert(!preset_id.includes("-"), { preset_id });
    assert(/^[a-zA-Z0-9_]+$$/.test(preset_id), { preset_id });
  }
}

// TODO - use TypeScript
class PresetData {
  subapp_id: string;
  preset_id: string;
  preset_values: Object;

  constructor(args) {
    const { preset_id, preset_values, subapp_id, ...rest } = args;
    assert(Object.keys(rest).length === 0, args);
    assert(preset_id && preset_values && subapp_id, args);

    this.subapp_id = subapp_id;
    this.preset_id = preset_id;
    this.preset_values = new PresetValues(preset_values);
  }
}
class PresetValues {
  constructor(args) {
    assert(
      [Object, PresetValues].includes(args.constructor),
      args,
      args.constructor
    );
    Object.assign(this, args);
  }
}

class PresetSavior {
  #subapp_id = null;

  constructor({ subapp_id }) {
    assert(subapp_id);
    this.#subapp_id = subapp_id;
  }

  get_saved_presets() {
    return this._get_presets();
  }

  save_preset(preset) {
    const { preset_id, preset_values } = preset;
    assert(preset_id);
    assert(preset_values);

    const presets = this._get_presets();

    if (presets.find((preset) => preset.preset_id === preset_id)) {
      // @ts-ignore
      assert.warning(
        "Trying to save " + preset_id + " but it is already saved."
      );
      return;
    }

    const subapp_id = this.#subapp_id;

    const preset_data = new PresetData({ preset_id, preset_values, subapp_id });
    presets.push(preset_data);

    this._save_presets(presets);
  }

  remove_preset(preset) {
    const { preset_id } = preset;
    assert(preset_id);

    let presets = this._get_presets();

    const old_length = presets.length;
    presets = presets.filter((preset) => preset.preset_id !== preset_id);
    const new_length = presets.length;

    if (new_length === old_length) {
      // @ts-ignore
      assert.warning(false, "Preset " + preset_id + " not found.");
    }
    if (new_length !== old_length - 1) {
      // @ts-ignore
      assert.warning(false, "Preset " + preset_id + " found multiple times.");
    }

    this._save_presets(presets);
  }

  _get_presets() {
    return PresetSerializer.deserialize_list(localStorage[this._storage_key]);
  }
  _save_presets(presets) {
    localStorage[this._storage_key] = PresetSerializer.serialize_list(presets);
  }
  get _storage_key() {
    return this.#subapp_id + "_presets";
  }
}

abstract class FakePreset {
  abstract is_randomizer_preset: boolean;
  abstract is_creator_preset: boolean;
  abstract preset_id;
  abstract preset_name;
  get_preset_value() {
    return null;
  }
}

class RandomizerPreset extends FakePreset {
  #picked = null;
  is_randomizer_preset = true;
  is_creator_preset = false;
  preset_id = "_random";
  preset_name = "<Random>";
  preset_list: PresetList;
  constructor({ preset_list }) {
    super();
    this.is_randomizer_preset = true;
    this.preset_list = preset_list;
  }
  get random_preset() {
    if (!this.#picked) {
      this.#picked = this.pick_random_preset();
    }
    assert(this.#picked.is_real_preset, this.#picked.preset_id, this.#picked);
    return this.#picked;
  }
  pick_random_preset() {
    const { random_candidates } = this.preset_list;
    const idx = Math.floor(Math.random() * random_candidates.length);
    return random_candidates[idx];
  }
}

class CreatorPreset extends FakePreset {
  is_randomizer_preset = false;
  is_creator_preset = true;
  preset_id = "_creator";
  preset_name = "<Creator>";
}

class NameIdConverter {
  static white_space_seralized = "-";
  static from_id_to_name(id) {
    assert(id);

    const sep_regex = /[-_]/;
    assert("--a-_-_--".split(sep_regex).filter(Boolean).join("") === "a");

    const name = id
      .split(sep_regex)
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(" ");

    // console.log({id, name});
    return name;
  }
  static from_name_to_id(name) {
    assert(name);

    const sep_regex = /[\s-_]/;
    assert(
      "  -- a-  _-  _--".split(sep_regex).filter(Boolean).join("") === "a"
    );

    const id = name
      .split(sep_regex)
      .filter(Boolean)
      .join(NameIdConverter.white_space_seralized)
      .toLowerCase();

    // console.log({name, id});
    return id;
  }
}

function make_unique(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

// TODO-later
// What Preset values should be required before saving? What happens when the user sets some to ''?
// TypeScript
//  - Create a strict type for preset_id

class LinkSerializer {
  private static _to_base64(str: string): string {
    let str__base64 = window.btoa(str);
    assert(window.btoa("ab?") === "YWI/");
    str__base64 = str__base64.split("/").join("_");
    assert(window.btoa("ab>") === "YWI+");
    str__base64 = str__base64.split("+").join("-");
    return str__base64;
  }
  private static _from_base64(str__base64: string): string {
    str__base64 = str__base64.split("_").join("/");
    str__base64 = str__base64.split("-").join("+");
    const str = window.atob(str__base64);
    return str;
  }
  static to_url(preset) {
    assert(preset instanceof Preset);
    assert(preset.is_saved_preset);

    const preset_string = PresetSerializer.serialize_single(preset);
    const preset_base64 = this._to_base64(preset_string);

    const url_base = window.location.href.split("#")[0];

    const { preset_id } = preset;
    const name_encoded = encodeURIComponent(preset_id);
    // @ts-ignore
    assert.warning(name !== name_encoded, { name, name_encoded });

    const link = url_base + "#" + name_encoded + "/" + preset_base64;
    return link;
  }
  static from_url() {
    let pipe_data = window.location.href.split("#")[1];
    if (!pipe_data) {
      return null;
    }

    pipe_data = pipe_data.split("/")[1];
    if (!pipe_data) {
      return null;
    }

    try {
      pipe_data = this._from_base64(pipe_data);
    } catch (err) {
      on_error(err);
      return null;
    }

    let preset_data: PresetData;
    try {
      preset_data = PresetSerializer.deserialize_single(pipe_data);
    } catch (err) {
      on_error(err);
      return null;
    }

    return preset_data;

    function on_error(err: Error) {
      show_toast("Wrong URL. The URL could not be processed.", {
        is_error: true,
      });
      track_error(err);
      console.log(pipe_data);
      console.error(err);
    }
  }
}
