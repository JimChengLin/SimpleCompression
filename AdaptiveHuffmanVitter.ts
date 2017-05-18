namespace Vitter {
    const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.~' + `:/?#[]@!$&'()*+,;=%`;
    const TABLE: { [id: string]: BitPack } = {};

    class BitPack {
        constructor(public len: number, public val: number) {
        }

        toString(): string {
            let res = '0b';
            const binVal = this.val.toString(2);
            for (let i = 0, len = this.len - binVal.length; i < len; ++i) {
                res += '0';
            }
            res += binVal;
            return res;
        }

        extend(other: BitPack): BitPack {
            this.len += other.len;
            this.val <<= other.len;
            this.val |= other.val;
            return this;
        }

        equals(other: BitPack): boolean {
            return this.len === other.len && this.val === other.val;
        }
    }

    export class BitPackHolder {
        container: BitPack[];

        constructor() {
            this.container = [];
        }

        toString(): string {
            // 2进制转64进制
            const bitArray = this.bitArray();
            bitArray.push(1);
            for (let i = 0, len = 6 - bitArray.length % 6; i < len && len !== 6; ++i) {
                bitArray.push(0);
            }

            let res = '';
            for (let i = 0, len = bitArray.length / 6; i < len; ++i) {
                let num = 0;
                for (let j = 0; j < 6; ++j) {
                    num <<= 1;
                    num |= bitArray[i * 6 + j];
                }
                res += ALPHABET[num];
            }
            return res;
        }

        static stringToBitArray(source: string): number[] {
            // 64进制转2进制
            const res: number[] = [];
            for (const char of source) {
                const num64 = ALPHABET.indexOf(char);
                for (let i = 5; i >= 0; --i) {
                    res.push(+Boolean(num64 & (1 << i)));
                }
            }

            // 删除EOF
            while (res[res.length - 1] === 0) {
                res.pop();
            }
            res.pop();
            return res;
        }

        private *bitStream(): Iterable<number> {
            for (let i = this.container.length - 1; i >= 0; --i) {
                const bitPack = this.container[i];
                for (let j = 0, len = bitPack.len; j < len; ++j) {
                    yield +Boolean(bitPack.val & (1 << j));
                }
            }
        }

        private bitArray(): number[] {
            const bitArray: number[] = [];
            for (const bit of this.bitStream()) {
                bitArray.push(bit);
            }
            return bitArray.reverse();
        }
    }

    (function init() {
        const e = Math.floor(Math.log2(ALPHABET.length));
        const r = ALPHABET.length - Math.pow(2, e);
        const k = 2 * r;

        for (let i = 0, len = ALPHABET.length - k, cnt = r; i < len; ++i, ++cnt) {
            TABLE[ALPHABET[i]] = new BitPack(e, cnt);
            // console.log(ALPHABET[i], TABLE[ALPHABET[i]].toString());
        }
        for (let j = ALPHABET.length - k, len = ALPHABET.length, cnt = 0; j < len; ++j, ++cnt) {
            TABLE[ALPHABET[j]] = new BitPack(e + 1, cnt);
            // console.log(ALPHABET[j], TABLE[ALPHABET[j]].toString());
        }
    })();

    export class Tree {
        private UPDATE_TABLE: { [id: string]: TreeNode };
        private NYT: TreeNode;

        private root: TreeNode;

        constructor() {
            this.root = new TreeNode();

            this.NYT = this.root;
            this.NYT.char = 'NYT';
            this.UPDATE_TABLE = {'NYT': this.NYT};
        }

        toString(): string {
            let res = '';

            function add(node: TreeNode, lv = 0) {
                if (!node) {
                    return;
                }

                let prefix = '';
                if (lv > 0) {
                    for (let i = 0; i < lv; ++i) {
                        prefix += '    ';
                    }
                }

                res += prefix + node.toString() + '\n';
                add(node.left, lv + 1);
                add(node.right, lv + 1);
            }

            add(this.root);
            return res;
        }

        encode(char: string): BitPack {
            let res: BitPack;

            if (!this.UPDATE_TABLE.hasOwnProperty(char)) {
                res = this.NYT.toBitPack().extend(TABLE[char]);
                this.update(this.NYT, char);
            } else {
                const charNode = this.UPDATE_TABLE[char];
                res = charNode.toBitPack();
                this.update(charNode);
            }

            return res;
        }

        decode(source: string): string {
            let res = '';

            const bitArray = BitPackHolder.stringToBitArray(source);
            let bitPack;
            let state = this.root;

            for (const bit of bitArray) {
                if (state === this.NYT && !bitPack) {
                    bitPack = new BitPack(0, 0);
                }
                if (bitPack) {
                    bitPack.extend({len: 1, val: bit});
                    for (const key in TABLE) {
                        if (TABLE[key].equals(bitPack)) {
                            res += key;
                            this.encode(key);

                            state = this.root;
                            bitPack = null;
                            break;
                        }
                    }
                } else {
                    if (bit === 0) {
                        state = state.left;
                    } else {
                        state = state.right;
                    }

                    if (state === this.NYT) {
                        continue;
                    }
                    if (state.char) {
                        res += state.char;
                        this.encode(state.char);
                        state = this.root;
                    }
                }
            }

            return res;
        }

        private update(q: TreeNode, char = '') {
            let leafToIncrement: TreeNode;

            if (q === this.NYT) {
                const NYTParent = new TreeNode();
                const charNode = new TreeNode();

                if (this.NYT.parent) {
                    this.NYT.parent.bindLeft(NYTParent);
                } else {
                    this.root = NYTParent;
                }

                NYTParent.bindLeft(this.NYT);
                NYTParent.bindRight(charNode);

                charNode.char = char;
                this.UPDATE_TABLE[char] = charNode;

                q = NYTParent;
                leafToIncrement = charNode;
            }
            else {
                const block = this.findBlock(q.weight).filter(val => val.isLeaf() === q.isLeaf());
                Tree.swap(q, block[block.length - 1]);
                if (q.parent.left === this.NYT) {
                    leafToIncrement = q;
                    q = q.parent;
                }
            }

            while (q !== this.root) {
                q = this.slideAndIncrement(q);
            }
            if (leafToIncrement) {
                this.slideAndIncrement(leafToIncrement);
            }
        }

        private slideAndIncrement(q: TreeNode): TreeNode {
            const block = q.isLeaf() ?
                this.findBlock(q.weight).filter(val => !val.isLeaf()) :
                this.findBlock(q.weight + 1).filter(val => val.isLeaf());

            let parent = q.parent;
            Tree.slide(q, block);
            ++q.weight;
            if (q.isLeaf()) {
                parent = q.parent;
            }
            return parent;
        }

        private static slide(q: TreeNode, block: TreeNode[]) {
            if (!block.length) {
                return;
            }

            const blockAfter = block.slice(0);
            blockAfter.push(q);
            block.unshift(q);
            const blockParentInfo = block.map((val): [TreeNode, number] => [val.parent, val.parent.left === val ? 0 : 1]);

            for (let i = 0; i < block.length; ++i) {
                const after = blockAfter[i];
                const [parent, direction] = blockParentInfo[i];

                if (direction === 0) {
                    parent.bindLeft(after);
                } else {
                    parent.bindRight(after);
                }
            }
        }

        private findBlock(weight: number): TreeNode[] {
            const res: TreeNode[] = [];

            let q = [this.root];
            while (q.length) {
                const tempQ: TreeNode[] = [];

                for (const cursor of q) {
                    if (cursor.left && cursor.left.weight >= weight) {
                        tempQ.push(cursor.left);
                    }
                    if (cursor.right && cursor.right.weight >= weight) {
                        tempQ.push(cursor.right);
                    }
                }

                for (let i = tempQ.length - 1; i >= 0; --i) {
                    const cursor = tempQ[i];
                    if (cursor.weight === weight) {
                        res.push(cursor);
                    }
                }
                q = tempQ;
            }

            return res.reverse();
        }

        private static swap(node: TreeNode, target: TreeNode) {
            if (node === target || node.parent === target) {
                return;
            }
            if (node.parent === target.parent) {
                [node.parent.left, node.parent.right] = [node.parent.right, node.parent.left];
                return;
            }

            const targetParent = target.parent;
            if (node.parent.left === node) {
                node.parent.bindLeft(target);
            } else {
                node.parent.bindRight(target);
            }
            if (targetParent.left === target) {
                targetParent.bindLeft(node);
            } else {
                targetParent.bindRight(node);
            }
        }
    }

    class TreeNode {
        parent: TreeNode;
        left: TreeNode;
        right: TreeNode;

        char: string;
        weight = 0;

        toString(): string {
            if (this.char) {
                return this.char + ' ' + this.weight.toString();
            } else {
                return '- ' + this.weight.toString();
            }
        }

        toBitPack(): BitPack {
            let cnt = 0;
            let code = 0;
            let cursor: TreeNode = this;
            while (cursor.parent) {
                if (cursor === cursor.parent.right) {
                    code |= (1 << cnt);
                }
                ++cnt;
                cursor = cursor.parent;
            }
            return new BitPack(cnt, code);
        }

        bindLeft(node: TreeNode) {
            this.left = node;
            node.parent = this;
        }

        bindRight(node: TreeNode) {
            this.right = node;
            node.parent = this;
        }

        isLeaf(): boolean {
            return !this.left && !this.right;
        }
    }

    // (function main() {
    //     const encodeTree = new Tree();
    //     const decodeTree = new Tree();
    //     const holder = new BitPackHolder();
    //
    //     for (const char of 'AA#BBB#C') {
    //         const res = encodeTree.encode(char);
    //         holder.container.push(res);
    //
    //         console.log(char, res.toString(), TABLE[char].toString());
    //         console.log(encodeTree.toString());
    //     }
    //
    //     console.log('encode:', holder.toString());
    //     console.log('decode:', decodeTree.decode(holder.toString()));
    // })();
}