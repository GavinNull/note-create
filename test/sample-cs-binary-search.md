# Chapter 4: Binary Search Trees

## 4.1 Binary Search Tree Definition

A Binary Search Tree (BST) is a binary tree that satisfies the following property: for every node X, all keys in the left subtree of X are smaller than the key in X, and all keys in the right subtree of X are larger than the key in X.

Definition: A Binary Search Tree is a binary tree where each node has a key, and the tree is organized such that the left subtree contains only nodes with keys less than the node's key, and the right subtree contains only nodes with keys greater than the node's key.

This property enables efficient searching: at each node, comparing the target key with the node's key tells us whether to search the left or right subtree, eliminating half the remaining tree at each step.

## 4.2 Search Operation

The search operation in a BST follows a simple recursive algorithm. Starting at the root, compare the target value X with the current node's key. If X is smaller, search the left subtree. If X is larger, search the right subtree. If equal, the element is found.

The time complexity of search in a BST is O(h) where h is the height of the tree. In the best case (a balanced tree), h = O(log n). In the worst case (a degenerate tree that resembles a linked list), h = O(n).

```c
TreeNode* search(TreeNode* root, int key) {
    if (root == NULL || root->key == key)
        return root;
    if (key < root->key)
        return search(root->left, key);
    return search(root->right, key);
}
```

Note: The recursive implementation is elegant but can cause stack overflow for very deep trees. An iterative version avoids this issue.

## 4.3 Insertion Operation

To insert a new key into a BST, we search for the key until we reach a NULL pointer, then insert the new node at that position. The algorithm naturally preserves the BST property.

```c
TreeNode* insert(TreeNode* root, int key) {
    if (root == NULL) {
        TreeNode* node = malloc(sizeof(TreeNode));
        node->key = key;
        node->left = node->right = NULL;
        return node;
    }
    if (key < root->key)
        root->left = insert(root->left, key);
    else if (key > root->key)
        root->right = insert(root->right, key);
    return root;
}
```

Theorem: Insertion into a BST always creates a new leaf node and preserves the BST property. The time complexity is O(h) where h is the height of the tree.

Proof: The insertion algorithm follows the same path as a search for the key. When it reaches NULL, it has found the correct leaf position. Since all comparisons maintain the BST invariant, the resulting tree is still a valid BST.

## 4.4 Deletion Operation

Deletion is the most complex operation. There are three cases:

1. The node is a leaf: simply remove it.
2. The node has one child: replace the node with its child.
3. The node has two children: find the inorder successor (smallest key in right subtree), copy its key to the node, then delete the successor.

Example: Deleting node 15 from the BST:
Step 1: Find node 15 (two children: 12 and 20)
Step 2: Find inorder successor = 17 (smallest in right subtree)
Step 3: Copy 17 to the node's position
Step 4: Delete the original node containing 17 (it has at most one child)

| Case | Condition | Time Complexity |
|------|-----------|-----------------|
| Leaf | No children | O(h) |
| One child | One subtree NULL | O(h) |
| Two children | Both subtrees exist | O(h) |

## 4.5 Traversal

Binary search trees support three standard depth-first traversals:

- **Inorder**: Left subtree → Node → Right subtree. Visits keys in sorted order.
- **Preorder**: Node → Left subtree → Right subtree. Useful for creating a copy.
- **Postorder**: Left subtree → Right subtree → Node. Useful for deletion.

Theorem: Inorder traversal of a BST visits all keys in sorted (ascending) order.

Figure 4.1: An example BST with 7 nodes showing inorder traversal path.
