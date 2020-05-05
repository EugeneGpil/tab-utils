import assert from "@brillout/assert";
import React from "react";
import Header from "../Header";
import Footer from "../Footer";
import "./full-view.css";
import on_page_load from "./on_page_load";
import { tab_app_logo } from "../../../tab_app_info";

export { FullView, MorePanel, LeftSide, RightSide, FullViewLayout, config };

function FullViewLayout(props) {
  assert(!props.id);
  return <div id="fv_full-view-layout" {...props} />;
}

function FullView(props) {
  const { children } = props;
  return (
    <>
      <Header />

      <div
        className="pretty_scroll_area__hide_scroll_element load-area"
        {...props}
      >
        {children}
        <div id="screen-buttons-wrapper">
          <div
            id="fullscreen-button"
            className="screen-button glass-background glass-background-button"
          >
            <span className="button-icon"></span>
            <span className="button-text"></span>
          </div>
          <br />
          <div
            id="center-button"
            className="screen-button glass-background glass-background-button"
          >
            <span className="button-icon"></span>
            <span className="button-text"></span>
          </div>
        </div>
      </div>
    </>
  );
}

function LeftSide(props) {
  assert(!props.id);
  return <div id="fv_left-side" {...props} />;
}

function RightSide(props) {
  assert(!props.id);
  return <div id="fv_right-side" {...props} />;
}

function MorePanel(props) {
  const { children } = props;
  return (
    <div id="more_panel">
      <div id="more_panel_background" className="glass-background"></div>
      {children}
      <Footer />
    </div>
  );
}

function config({ onPageLoad, ...conf }) {
  return {
    renderToDom: true,
    renderToHtml: true,
    favicon: tab_app_logo,
    ...conf,
    on_page_load: (goldpage_args) => on_page_load(onPageLoad, goldpage_args),
  };
}
