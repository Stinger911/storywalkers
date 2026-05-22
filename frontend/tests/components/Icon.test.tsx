import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { Icon } from "../../src/components/ui/icon";

describe("Icon", () => {
  it("renders repeated icon instances with their own paths", () => {
    const { container } = render(() => (
      <div>
        <Icon name="open_in_new" data-testid="external-one" />
        <Icon name="open_in_new" data-testid="external-two" />
      </div>
    ));

    const icons = container.querySelectorAll("svg");

    expect(icons).toHaveLength(2);
    expect(icons[0].querySelectorAll("path")).toHaveLength(3);
    expect(icons[1].querySelectorAll("path")).toHaveLength(3);
  });
});
