import React from "react";
import getPrefix from "./get-prefix";

function getScrollParent(node) {
  let offsetParent = node;
  while ((offsetParent = offsetParent.offsetParent)) {
    const overflowYVal = getComputedStyle(offsetParent, null).getPropertyValue("overflow-y");
    if (overflowYVal === "auto" || overflowYVal === "scroll") return offsetParent;
  }
  return window;
}

function getTotalOffsetTop(node) {
  if (node === window) return 0;
  const docElem = document.documentElement;
  return node.getBoundingClientRect().top + (window.pageYOffset || docElem.scrollTop) - (docElem.clientTop || 0);
}

const allBoxes = {};
let nextBoxId = 1;
export function updateAll() {
  Object.keys(allBoxes).forEach(b => allBoxes[b].handleScroll());
}

export default class OSBox extends React.Component {
  static displayName = "OSBox"

  static propTypes = {
    stickToTop: React.PropTypes.bool,
    setOffset: React.PropTypes.func
  }

  static defaultProps = {
    stickToTop: false,
    setOffset: (node, transformMethod, offset) => {
      node.style[transformMethod] = `translate3d(0, ${offset}px,0)`;
    }
  }

  componentDidMount() {
    this.node = this.refs.container;
    this.transformMethod = getPrefix("transform", this.node);
    if (!this.transformMethod) return;

    this.offset = 0;
    this.lastScrollY = 0;
    this.lastParentHeight = 0;
    this.lastChildHeight = 0;

    this.computedStyle = getComputedStyle(this.node, null);
    this.computedParentStyle = getComputedStyle(this.node.parentNode, null);
    this.scrollPane = getScrollParent(this.node);

    this.scrollPane.addEventListener("scroll", this.handleScroll);
    this.scrollPane.addEventListener("mousewheel", this.handleScroll);
    window.addEventListener("resize", this.handleScroll);
    this.handleScroll({force: true});
    this.myId = nextBoxId++;
    allBoxes[this.myId] = this;
    this.setupMutationObserver();
  }

  componentWillUnmount() {
    if (!this.transformMethod) return;
    this.scrollPane.removeEventListener("scroll", this.handleScroll);
    this.scrollPane.removeEventListener("mousewheel", this.handleScroll);
    window.removeEventListener("resize", this.handleScroll);
    delete allBoxes[this.myId];
    if (this.observer) this.observer.disconnect();
  }

  setupMutationObserver() {
    if (window.MutationObserver) {
      this.observer = new MutationObserver(() => this.handleScroll({force: true}));
      this.observer.observe(
        this.scrollPane === window ? document.body : this.scrollPane,
        {subtree: true, attributes: true, childList: true, attributeFilter: ["style", "class"]}
      );
    }
  }

  handleScroll = ({force} = {}) => {
    if (this.calculatedScrollPosThisTick) return;
    const currentScrollY = this.scrollPane === window ? this.scrollPane.scrollY : this.scrollPane.scrollTop;
    const scrollDelta = currentScrollY - this.lastScrollY;
    if (!scrollDelta && !force) return;

    this.calculatedScrollPosThisTick = true;
    setTimeout(() => {this.calculatedScrollPosThisTick = false; });

    const verticalMargin =
      parseInt(this.computedStyle.getPropertyValue("margin-top"), 10) +
      parseInt(this.computedStyle.getPropertyValue("margin-bottom"), 10) +
      parseInt(this.computedParentStyle.getPropertyValue("padding-top"), 10) +
      parseInt(this.computedParentStyle.getPropertyValue("padding-bottom"), 10);

    const nodeHeight = this.node.offsetHeight + verticalMargin;

    const parentOffsetTop = getTotalOffsetTop(this.node.parentNode);
    const scrollPaneOffsetTop = getTotalOffsetTop(this.scrollPane) + window.scrollY;

    let newOffset = this.offset;
    const scrollPaneHeight = this.scrollPane === window ? window.innerHeight : this.scrollPane.offsetHeight;

    if (scrollDelta < 0) { // up
      if (scrollPaneHeight > nodeHeight) { // if node smaller than window
        if (this.props.stickToTop) {
          newOffset = scrollPaneOffsetTop - parentOffsetTop;
        } else {
          if (scrollPaneOffsetTop + scrollPaneHeight < parentOffsetTop + this.offset + nodeHeight) {
            newOffset = scrollPaneOffsetTop - parentOffsetTop + scrollPaneHeight - nodeHeight;
          }
        }
      } else { // if node taller than window
        if (this.props.stickToBottom) {
          if (this.offset + parentOffsetTop > scrollPaneOffsetTop) {
            newOffset = scrollPaneOffsetTop - parentOffsetTop;
          }
        } else {
          if (this.offset + parentOffsetTop > scrollPaneOffsetTop) {
            newOffset = scrollPaneOffsetTop - parentOffsetTop;
          }
        }
      }
    } else if (scrollDelta > 0 || force) { // down
      if (scrollPaneHeight > nodeHeight) { // if node smaller than window
        if (this.props.stickToBottom) {
          newOffset = scrollPaneOffsetTop - parentOffsetTop + scrollPaneHeight - nodeHeight;
        } else {
          if (this.props.stickToTop || parentOffsetTop + this.offset < scrollPaneOffsetTop) {
            newOffset = scrollPaneOffsetTop - parentOffsetTop;
          }
        }
      } else { // if node taller than window
        if (this.props.stickToBottom) {
          newOffset = scrollPaneOffsetTop - parentOffsetTop + scrollPaneHeight - nodeHeight;
        } else {
          if (this.offset + nodeHeight - scrollPaneOffsetTop < scrollPaneHeight - parentOffsetTop) {
            newOffset = scrollPaneOffsetTop - parentOffsetTop + scrollPaneHeight - nodeHeight;
          }
        }
      }
    }
    newOffset = Math.max(Math.min(newOffset, this.node.parentNode.offsetHeight - nodeHeight), 0);
    if (newOffset !== null && this.offset !== newOffset) {
      this.props.setOffset(this.node, this.transformMethod, newOffset);
      this.offset = newOffset;
    }
    this.lastScrollY = currentScrollY;
    this.lastParentHeight = this.node.parentNode.offsetHeight;
    this.lastChildHeight = this.node.offsetHeight;
  }

  render() {
    const {stickToTop, ...rest} = this.props;
    return (
      <div {...rest} ref="container"/>
    );
  }
}
