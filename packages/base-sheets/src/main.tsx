import { UniverSheet } from '@univer/core';
import { RenderEngine } from '@univer/base-render';
import { UniverComponentSheet } from '@univer/style-universheet';
import { ClipboardPlugin } from '@univer/sheets-plugin-clipboard';
import { NumfmtPlugin } from '@univer/sheets-plugin-numfmt';
import { DEFAULT_FORMULA_DATA, DEFAULT_FORMULA_DATA_DOWN, FormulaPlugin } from '@univer/sheets-plugin-formula';
import { DEFAULT_WORKBOOK_DATA, DEFAULT_WORKBOOK_DATA_DOWN } from '@univer/common-plugin-data';
import { SheetPlugin } from './SheetPlugin';

const uiDefaultConfigUp = {
    container: 'universheet-demo-up',
    layout: {
        innerRight: false,
        outerLeft: false,
        toolBarConfig: {
            paintFormat: false,
            currencyFormat: false,
            percentageFormat: false,
            numberDecrease: false,
            numberIncrease: false,
            moreFormats: false,
        },
    },
    selections: {
        'sheet-01': [
            {
                selection: {
                    startRow: 0,
                    endRow: 0,
                    startColumn: 3,
                    endColumn: 3,
                },
                cell: {
                    row: 0,
                    column: 3,
                },
            },
        ],
        // 'sheet-01': [
        //     {
        //         selection: {
        //             startRow: 13,
        //             endRow: 14,
        //             startColumn: 1,
        //             endColumn: 2,
        //         },
        //     },
        //     {
        //         selection: {
        //             startRow: 16,
        //             endRow: 18,
        //             startColumn: 1,
        //             endColumn: 2,
        //         },
        //         cell: {
        //             row: 16,
        //             column: 1,
        //         },
        //     },
        // ],
        // 'sheet-02': [
        //     {
        //         selection: {
        //             startRow: 17,
        //             endRow: 20,
        //             startColumn: 1,
        //             endColumn: 2,
        //         },
        //     },
        //     {
        //         selection: {
        //             startRow: 22,
        //             endRow: 23,
        //             startColumn: 1,
        //             endColumn: 2,
        //         },
        //     },
        //     {
        //         selection: {
        //             startRow: 25,
        //             endRow: 27,
        //             startColumn: 4,
        //             endColumn: 6,
        //         },
        //         cell: {
        //             row: 25,
        //             column: 4,
        //         },
        //     },
        // ],
    },
};

const univerSheetUp = UniverSheet.newInstance(DEFAULT_WORKBOOK_DATA);
univerSheetUp.installPlugin(new RenderEngine());
univerSheetUp.installPlugin(new UniverComponentSheet());
FormulaPlugin.create(DEFAULT_FORMULA_DATA).installTo(univerSheetUp);

let sheetPlugin = new SheetPlugin(uiDefaultConfigUp);
let clipboardPlugin = new ClipboardPlugin();
univerSheetUp.installPlugin(sheetPlugin);
univerSheetUp.installPlugin(clipboardPlugin);
univerSheetUp.installPlugin(new NumfmtPlugin());
(window as any).sheetPlugin = sheetPlugin;

const uiDefaultConfigDown = {
    container: 'universheet-demo-down',
    layout: 'auto',
    selections: {
        'sheet-0001': [
            {
                selection: {
                    startRow: 2,
                    endRow: 2,
                    startColumn: 3,
                    endColumn: 3,
                },
                cell: {
                    row: 2,
                    column: 3,
                },
            },
        ],
    },
};

const univerSheetDown = UniverSheet.newInstance(DEFAULT_WORKBOOK_DATA_DOWN);
univerSheetDown.installPlugin(new RenderEngine());
univerSheetDown.installPlugin(new UniverComponentSheet());
FormulaPlugin.create(DEFAULT_FORMULA_DATA_DOWN).installTo(univerSheetDown);

univerSheetDown.installPlugin(new SheetPlugin(uiDefaultConfigDown));
univerSheetDown.installPlugin(new ClipboardPlugin());
univerSheetDown.installPlugin(new NumfmtPlugin());
