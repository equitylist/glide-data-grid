import * as React from "react";

import { styled } from "@linaria/react";
import Select, { type MenuProps, components } from "react-select";

import {
    type CustomCell,
    type ProvideEditorCallback,
    type CustomRenderer,
    getMiddleCenterBias,
    useTheme,
    GridCellKind,
    TextCellEntry,
} from "glide-data-grid-fork";

interface CustomMenuProps extends MenuProps<any> {}

const CustomMenu: React.FC<CustomMenuProps> = p => {
    const { Menu } = components;
    const { children, ...rest } = p;
    return <Menu {...rest}>{children}</Menu>;
};

type DropdownOption = string | { value: string; label: string } | undefined | null;

export type DropdownCell = CustomCell<DropdownCellProps>;

const Wrap = styled.div`
    display: flex;
    flex-direction: column;
    align-items: stretch;

    .glide-select {
        font-family: var(--gdg-font-family);
        font-size: var(--gdg-editor-font-size);
    }
`;

const PortalWrap = styled.div`
    font-family: var(--gdg-font-family);
    font-size: var(--gdg-editor-font-size);
    color: var(--gdg-text-dark);

    > div {
        border-radius: 4px;
        border: 1px solid var(--gdg-border-color);
    }
`;

// This is required since the padding is disabled for this cell type
// The settings are based on the "pad" settings in the data-grid-overlay-editor-style.tsx
const ReadOnlyWrap = styled.div`
    display: "flex";
    margin: auto 8.5px;
    padding-bottom: 3px;
`;

interface DropdownCellProps {
    readonly kind: "input-dropdown-cell";
    readonly value: string | undefined | null;
    readonly allowedValues: readonly DropdownOption[];
    readonly fetchOptions?: (input: string) => Promise<DropdownOption[]>; // New prop for API call
}

// Editor Component
const Editor: ReturnType<ProvideEditorCallback<DropdownCell>> = p => {
    const { value: cell, onFinishedEditing, initialValue } = p;
    const { allowedValues, value: valueIn, fetchOptions } = cell.data;

    const [value, setValue] = React.useState(valueIn);
    const [inputValue, setInputValue] = React.useState(initialValue ?? "");
    const [options, setOptions] = React.useState<DropdownOption[]>(() => Array.from(allowedValues));
    const [isFocused, setIsFocused] = React.useState(false);

    const theme = useTheme();

    // Debounced API Call
    React.useEffect(() => {
        if (fetchOptions && inputValue) {
            const timeout = setTimeout(() => {
                fetchOptions(inputValue).then(fetchedOptions => setOptions(fetchedOptions)).catch(console.error);
            }, 300); // Debounce delay
            return () => clearTimeout(timeout);
        }
    }, [inputValue, fetchOptions]);

    const values = React.useMemo(() => {
        return options.map(option => {
            if (typeof option === "string" || option === null || option === undefined) {
                return { value: option, label: option?.toString() ?? "" };
            }
            return option;
        });
    }, [options]);

    if (cell.readonly) {
        return (
            <ReadOnlyWrap>
                <TextCellEntry
                    highlight={true}
                    autoFocus={false}
                    disabled={true}
                    value={value ?? ""}
                    onChange={() => undefined}
                />
            </ReadOnlyWrap>
        );
    }

    console.info("DropdownCell Editor", { value, values, inputValue, isFocused, cell });

    return (
        <Wrap>
            {isFocused || !value ? (
                <Select
                    className="glide-select"
                    inputValue={inputValue}
                    onInputChange={setInputValue}
                    menuPlacement={"auto"}
                    value={values.find(x => x.value === value)}
                    styles={{
                        control: base => ({
                            ...base,
                            border: 0,
                            boxShadow: "none",
                        }),
                        option: (base, { isFocused: isFocused2 }) => ({
                            ...base,
                            fontSize: theme.editorFontSize,
                            fontFamily: theme.fontFamily,
                            cursor: isFocused2 ? "pointer" : undefined,
                            paddingLeft: theme.cellHorizontalPadding,
                            paddingRight: theme.cellHorizontalPadding,
                            ":active": {
                                ...base[":active"],
                                color: theme.accentFg,
                            },
                            ":empty::after": {
                                content: '"&nbsp;"',
                                visibility: "hidden",
                            },
                        }),
                    }}
                    theme={t => {
                        return {
                            ...t,
                            colors: {
                                ...t.colors,
                                neutral0: theme.bgCell,
                                neutral20: theme.bgCellMedium,
                                neutral50: theme.textLight,
                                neutral80: theme.textDark,
                                primary: theme.accentColor,
                            },
                        };
                    }}
                    menuPortalTarget={document.getElementById("portal")}
                    autoFocus={true}
                    openMenuOnFocus={true}
                    components={{
                        DropdownIndicator: () => null,
                        IndicatorSeparator: () => null,
                        Menu: props => (
                            <PortalWrap>
                                <CustomMenu className={"click-outside-ignore"} {...props} />
                            </PortalWrap>
                        ),
                    }}
                    options={values}
                    onChange={async e => {
                        if (e === null) return;
                        setValue(e.value);
                        setIsFocused(false);
                        await new Promise(r => window.requestAnimationFrame(r));
                        onFinishedEditing({
                            ...cell,
                            data: {
                                ...cell.data,
                                value: e.value,
                            },
                        });
                    }}
                    onBlur={() => setIsFocused(false)}
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onFocus={() => setIsFocused(true)}
                    autoFocus={false}
                    readOnly
                    style={{
                        fontFamily: theme.fontFamily,
                        fontSize: theme.editorFontSize,
                        border: "none",
                        background: "transparent",
                        padding: "8px 25px",
                        margin: "0",
                    }}
                />
            )}
        </Wrap>
    );
};

const renderer: CustomRenderer<DropdownCell> = {
    kind: GridCellKind.Custom,
    isMatch: (c): c is DropdownCell => (c.data as any).kind === "input-dropdown-cell",
    draw: (args, cell) => {
        const { ctx, theme, rect } = args;
        const { value } = cell.data;

        const displayText = value;
        if (displayText) {
            ctx.fillStyle = theme.textDark;
            ctx.fillText(
                displayText,
                rect.x + theme.cellHorizontalPadding,
                rect.y + rect.height / 2 + getMiddleCenterBias(ctx, theme)
            );
        }
        return true;
    },
    measure: (ctx, cell, theme) => {
        const { value } = cell.data;
        return (value ? ctx.measureText(value).width : 0) + theme.cellHorizontalPadding * 2;
    },
    provideEditor: () => ({
        editor: Editor,
        disablePadding: true,
        deletedValue: v => ({
            ...v,
            copyData: "",
            data: {
                ...v.data,
                value: "",
            },
        }),
    }),
    onPaste: (_v, d) => ({
        ...d,
        value: d.value,
    }),
};

export default renderer;