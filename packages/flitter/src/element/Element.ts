import type RenderObject from "../renderobject/RenderObject";
import type { BuildOwner, Scheduler, GlobalKey } from "../framework";
import Widget from "../widget/Widget";
import { ElementType } from "./ElementType";
import { NotImplementedError } from "../exception";

class Element {
  scheduler: Scheduler;
  buildOwner!: BuildOwner;
  widget: Widget;
  parent?: Element;
  dirty = true;
  depth = 0;
  constructor(widget: Widget) {
    this.widget = widget;
  }
  type: ElementType = ElementType.none;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  visitChildren(visitor: (child: Element) => void) {
    throw new NotImplementedError("visitChildren");
  }

  get renderObject(): RenderObject {
    let result: RenderObject | null = null;

    this.visitChildren(child => {
      if (result == null) {
        result = child.renderObject;
      }
    });

    if (result == null) throw new Error("can not find render object");
    return result;
  }

  //There are 5 case
  // 1. child is not null, but widget is null
  // in this case, child must be unmounted
  // 2. child is null, widget is null
  // nothing happened
  // 3. child is null, widget is not null
  // newWidget would be inflated,
  // 4. child is not null, widget is not null, and widget can be update
  // in this case, just update widget configuration
  // 5. it is similar to 4 but widget can not be update,
  // in this case, child must be unmounted and newWidget would be inflated
  updateChild(
    child?: Element | null,
    newWidget?: Widget | null,
  ): Element | null | undefined {
    if (child != null && newWidget == null) {
      child.unmount();
      return null;
    } else if (child == null && newWidget == null) {
      //nothing happen
    } else if (child == null && newWidget != null) {
      return this.inflateWidget(newWidget);
    } else if (
      child != null &&
      newWidget != null &&
      Widget.canUpdate(child.widget, newWidget)
    ) {
      child.update(newWidget);
      return child;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      child!.unmount();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.inflateWidget(newWidget!);
    }
  }

  unmount() {
    this.parent = undefined;
  }

  mount(newParent?: Element) {
    if (newParent) {
      this.buildOwner = newParent.buildOwner;
      this.depth = newParent.depth + 1;
      this.scheduler = newParent.scheduler;
    }
    this.parent = newParent;

    if ((this.widget.key as GlobalKey)?.isGlobalKey) {
      this.buildOwner.registerGlobalKey(this.widget.key, this);
    }
  }

  update(newWidget: Widget) {
    this.widget = newWidget;
  }

  inflateWidget(childWidget: Widget): Element {
    const newChild = childWidget.createElement();
    newChild.mount(this);
    return newChild;
  }

  rebuild({ force = false }: { force?: boolean } = {}) {
    if (!this.dirty && !force) return;
    this.dirty = false;
    this.performRebuild();
  }

  protected performRebuild() {
    throw new Error("not implemented performRebuild");
  }

  markNeedsBuild() {
    this.dirty = true;
    this.buildOwner.scheduleFor(this);
  }
}

export default Element;
