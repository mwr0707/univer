import { IGridRange, IRangeData, IUnitRange, ObjectMatrix } from '@univer/core';
import { generateAstNode } from '../Analysis/Tools';
import { FunctionNode, PrefixNode, ReferenceNode, SuffixNode, UnionNode } from '../AstNode';
import { BaseAstNode } from '../AstNode/BaseAstNode';
import { NodeType } from '../AstNode/NodeType';
import { FormulaDataType, IInterpreterDatasetConfig, PreCalculateNodeType } from '../Basics/Common';
import { prefixToken, suffixToken } from '../Basics/Token';
import { Interpreter } from '../Interpreter/Interpreter';
import { BaseReferenceObject } from '../ReferenceObject/BaseReferenceObject';
import { FormulaDependencyTree } from './DependencyTree';
export class FormulaDependencyGenerator {
    private _updateRangeFlattenCache = new Map<string, Map<string, ObjectMatrix<boolean>>>();

    constructor(private _formulaData: FormulaDataType, private _forceCalculate = false) {}

    updateRangeFlatten(updateRangeList: IUnitRange[]) {
        if (this._forceCalculate) {
            return;
        }
        this._updateRangeFlattenCache = new Map<string, Map<string, ObjectMatrix<boolean>>>();
        for (let i = 0; i < updateRangeList.length; i++) {
            const gridRange = updateRangeList[i];
            const range = gridRange.rangeData;
            const sheetId = gridRange.sheetId;
            const unitId = gridRange.unitId;

            this._addFlattenCache(unitId, sheetId, range);
        }
    }

    private _addFlattenCache(unitId: string, sheetId: string, rangeData: IRangeData) {
        let unitMatrix = this._updateRangeFlattenCache.get(unitId);
        if (!unitMatrix) {
            unitMatrix = new Map<string, ObjectMatrix<boolean>>();
            this._updateRangeFlattenCache.set(unitId, unitMatrix);
        }

        let sheetMatrix = unitMatrix.get(sheetId);
        if (!sheetMatrix) {
            sheetMatrix = new ObjectMatrix<boolean>();
            unitMatrix.set(sheetId, sheetMatrix);
        }

        // don't use destructuring assignment
        const startRow = rangeData.startRow;

        const startColumn = rangeData.startColumn;

        const endRow = rangeData.endRow;

        const endColumn = rangeData.endColumn;

        // don't use chained calls
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startColumn; c <= endColumn; c++) {
                sheetMatrix.setValue(r, c, true);
            }
        }
    }

    private _isPreCalculateNode(node: BaseAstNode) {
        if (node.nodeType === NodeType.UNION) {
            return true;
        }

        if (node.nodeType === NodeType.PREFIX && (node as PrefixNode).getToken() === prefixToken.AT) {
            return true;
        }

        if (node.nodeType === NodeType.SUFFIX && (node as SuffixNode).getToken() === suffixToken.POUND) {
            return true;
        }

        return false;
    }

    private _nodeTraversalRef(node: BaseAstNode, result: PreCalculateNodeType[]) {
        const children = node.getChildren();
        const childrenCount = children.length;
        for (let i = 0; i < childrenCount; i++) {
            const item = children[i];
            if (this._isPreCalculateNode(node)) {
                result.push(item as PreCalculateNodeType);
                continue;
            } else if (item.nodeType === NodeType.REFERENCE) {
                result.push(item as PreCalculateNodeType);
            }
            this._nodeTraversalRef(item, result);
        }
    }

    private _nodeTraversalReferenceFunction(node: BaseAstNode, result: FunctionNode[]) {
        const children = node.getChildren();
        const childrenCount = children.length;
        for (let i = 0; i < childrenCount; i++) {
            const item = children[i];
            if (item.nodeType === NodeType.FUNCTION && (item as FunctionNode).isAddress()) {
                result.push(item as FunctionNode);
                continue;
            }
            this._nodeTraversalReferenceFunction(item, result);
        }
    }

    private async _getRangeListByNode(node: BaseAstNode, formulaInterpreter: Interpreter) {
        // ref function in offset indirect INDEX
        const preCalculateNodeList: PreCalculateNodeType[] = [];
        const referenceFunctionList: FunctionNode[] = [];

        this._nodeTraversalRef(node, preCalculateNodeList);

        this._nodeTraversalReferenceFunction(node, referenceFunctionList);

        const rangeList: IUnitRange[] = [];

        for (let i = 0, len = preCalculateNodeList.length; i < len; i++) {
            const node = preCalculateNodeList[i];

            const value = formulaInterpreter.executePreCalculateNode(node) as BaseReferenceObject;

            const gridRange = value.toUnitRange();

            rangeList.push(gridRange);
        }

        for (let i = 0, len = referenceFunctionList.length; i < len; i++) {
            const node = referenceFunctionList[i];
            let value: BaseReferenceObject;
            if (formulaInterpreter.checkAsyncNode(node)) {
                value = (await formulaInterpreter.executeAsync(node)) as BaseReferenceObject;
            } else {
                value = formulaInterpreter.execute(node) as BaseReferenceObject;
            }

            const gridRange = value.toUnitRange();

            rangeList.push(gridRange);
        }

        return rangeList;
    }

    private _includeTree(tree: FormulaDependencyTree) {
        const unitId = tree.unitId;
        const sheetId = tree.sheetId;
        const row = tree.row;
        const column = tree.column;

        if (!this._updateRangeFlattenCache.has(unitId)) {
            return false;
        }

        const sheetObjectMatrix = this._updateRangeFlattenCache.get(unitId)!;

        if (!sheetObjectMatrix.has(sheetId)) {
            return false;
        }

        const rangeObjectMatrix = sheetObjectMatrix.get(sheetId)!;

        if (rangeObjectMatrix.getValue(row, column)) {
            return true;
        }

        return false;
    }

    private _getUpdateTreeListAndMakeDependency(treeList: FormulaDependencyTree[]) {
        const newTreeList: FormulaDependencyTree[] = [];
        for (let i = 0, len = treeList.length; i < len; i++) {
            const tree = treeList[i];
            for (let m = 0, mLen = treeList.length; m < mLen; m++) {
                const treeMatch = treeList[i];
                if (tree === treeMatch) {
                    continue;
                }

                if (tree.dependency(treeMatch)) {
                    tree.pushChildren(treeMatch);
                }
            }

            if (this._forceCalculate || this._includeTree(tree)) {
                newTreeList.push(tree);
            }
        }

        return newTreeList;
    }

    private _calculateRunList(treeList: FormulaDependencyTree[]) {
        let stack = treeList;
        const formulaRunList = [];
        while (stack.length > 0) {
            let tree = stack.pop();

            if (tree === undefined || tree.isSkip()) {
                continue;
            }

            if (tree.isAdded()) {
                formulaRunList.push(tree);
                continue;
            }

            const cacheStack: FormulaDependencyTree[] = [];

            for (let i = 0, len = tree.parents.length; i < len; i++) {
                const parentTree = tree.parents[i];
                cacheStack.push(parentTree);
            }

            if (cacheStack.length == 0) {
                formulaRunList.push(tree);
                tree.setSkip();
            } else {
                tree.setAdded();
                stack.push(tree);
                stack = stack.concat(cacheStack);
            }
        }

        return formulaRunList.reverse();
    }

    async generate(updateRangeList: IUnitRange[] = [], interpreterDatasetConfig?: IInterpreterDatasetConfig) {
        this.updateRangeFlatten(updateRangeList);

        const formulaInterpreter = Interpreter.create(interpreterDatasetConfig);

        const formulaDataKeys = Object.keys(this._formulaData);

        const treeList: FormulaDependencyTree[] = [];

        for (let unitId of formulaDataKeys) {
            const sheetData = this._formulaData[unitId];

            const sheetDataKeys = Object.keys(sheetData);

            for (let sheetId of sheetDataKeys) {
                const matrixData = new ObjectMatrix(sheetData[sheetId]);

                matrixData.forEach((row, rangeRow) => {
                    rangeRow.forEach((column, formulaData) => {
                        const formulaString = formulaData.formula;
                        const node = generateAstNode(formulaString);

                        const FDtree = new FormulaDependencyTree();

                        FDtree.node = node;
                        FDtree.formula = formulaString;
                        FDtree.unitId = unitId;
                        FDtree.sheetId = sheetId;
                        FDtree.row = row;
                        FDtree.column = column;

                        treeList.push(FDtree);
                    });
                });
            }
        }

        for (let i = 0, len = treeList.length; i < len; i++) {
            const tree = treeList[i];

            formulaInterpreter.setCurrentPosition(tree.row, tree.column, tree.sheetId, tree.unitId);

            const rangeList = await this._getRangeListByNode(tree.node, formulaInterpreter);

            for (let r = 0, rLen = rangeList.length; r < rLen; r++) {
                tree.pushRangeList(rangeList[r]);
            }
        }

        const updateTreeList = this._getUpdateTreeListAndMakeDependency(treeList);

        return Promise.resolve(this._calculateRunList(updateTreeList));
    }

    static create(formulaData: FormulaDataType, forceCalculate = false) {
        return new FormulaDependencyGenerator(formulaData, forceCalculate);
    }
}
