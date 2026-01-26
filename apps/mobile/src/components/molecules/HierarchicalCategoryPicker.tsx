import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { ChevronRight, ChevronDown, Search, Check } from 'lucide-react-native';
import type {
  ActivityCategory,
  ActivityCategoryNode,
} from '@/lib/supabase/services/activity-categories';
import { buildCategoryTree } from '@/lib/supabase/services/activity-categories';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Full path of category names from root to selected node. */
export type CategoryPath = string[];

export interface HierarchicalCategoryPickerProps {
  /** Flat list of all categories (from CRUD service). */
  categories: ActivityCategory[];
  /** Currently selected category id (if any). */
  selectedCategoryId?: string | null;
  /** Called when the user selects a category at any level. */
  onSelect: (categoryId: string, path: CategoryPath) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const HierarchicalCategoryPicker = ({
  categories,
  selectedCategoryId,
  onSelect,
}: HierarchicalCategoryPickerProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Build the tree structure once from flat categories
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

  // Build a lookup map for constructing paths
  const categoryMap = useMemo(() => {
    const map = new Map<string, ActivityCategory>();
    for (const cat of categories) {
      map.set(cat.id, cat);
    }
    return map;
  }, [categories]);

  // Build full path (array of names) from root to a given category
  const buildPath = useCallback(
    (categoryId: string): CategoryPath => {
      const path: string[] = [];
      let current = categoryMap.get(categoryId);
      while (current) {
        path.unshift(current.name);
        current = current.parent_id
          ? categoryMap.get(current.parent_id)
          : undefined;
      }
      return path;
    },
    [categoryMap]
  );

  // Filter categories by search query
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree;

    const query = searchQuery.toLowerCase();

    // Collect IDs of matching categories and all their ancestors
    const matchingIds = new Set<string>();
    for (const cat of categories) {
      if (cat.name.toLowerCase().includes(query)) {
        matchingIds.add(cat.id);
        // Walk up to root, adding ancestors
        let parent = cat.parent_id
          ? categoryMap.get(cat.parent_id)
          : undefined;
        while (parent) {
          matchingIds.add(parent.id);
          parent = parent.parent_id
            ? categoryMap.get(parent.parent_id)
            : undefined;
        }
      }
    }

    // Recursively prune tree to only matching branches
    function prune(nodes: ActivityCategoryNode[]): ActivityCategoryNode[] {
      return nodes
        .filter((n) => matchingIds.has(n.id))
        .map((n) => ({ ...n, children: prune(n.children) }));
    }

    return prune(tree);
  }, [tree, categories, categoryMap, searchQuery]);

  // When searching, auto-expand all visible nodes so matches are revealed
  const effectiveExpandedIds = useMemo(() => {
    if (!searchQuery.trim()) return expandedIds;
    const all = new Set<string>();
    for (const cat of categories) {
      all.add(cat.id);
    }
    return all;
  }, [searchQuery, expandedIds, categories]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (categoryId: string) => {
      onSelect(categoryId, buildPath(categoryId));
    },
    [onSelect, buildPath]
  );

  // Recursive renderer
  const renderNode = useCallback(
    (node: ActivityCategoryNode, depth: number) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = effectiveExpandedIds.has(node.id);
      const isSelected = node.id === selectedCategoryId;
      const isNameMatch =
        searchQuery.trim() &&
        node.name.toLowerCase().includes(searchQuery.toLowerCase());

      return (
        <View key={node.id}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => handleSelect(node.id)}
            className={`flex-row items-center rounded-xl px-3 py-3 ${
              isSelected ? 'bg-[#DBEAFE]' : 'bg-transparent'
            } active:opacity-80`}
            style={{ paddingLeft: 12 + depth * 20 }}
          >
            {/* Expand/collapse chevron */}
            {hasChildren ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.id);
                }}
                hitSlop={8}
                className="mr-2 rounded-md p-1"
              >
                {isExpanded ? (
                  <ChevronDown size={16} color="#64748B" />
                ) : (
                  <ChevronRight size={16} color="#64748B" />
                )}
              </Pressable>
            ) : (
              <View className="mr-2 w-[24px]" />
            )}

            {/* Color dot */}
            {node.color ? (
              <View
                className="mr-2 h-3 w-3 rounded-full"
                style={{ backgroundColor: node.color }}
              />
            ) : null}

            {/* Category name */}
            <Text
              className={`flex-1 text-base ${
                isSelected
                  ? 'font-bold text-[#2563EB]'
                  : depth === 0
                    ? 'font-semibold text-[#111827]'
                    : 'font-normal text-[#374151]'
              }`}
              numberOfLines={1}
            >
              {isNameMatch ? highlightMatch(node.name, searchQuery) : node.name}
            </Text>

            {/* Selected checkmark */}
            {isSelected ? <Check size={18} color="#2563EB" /> : null}
          </Pressable>

          {/* Children */}
          {hasChildren && isExpanded
            ? node.children.map((child) => renderNode(child, depth + 1))
            : null}
        </View>
      );
    },
    [
      effectiveExpandedIds,
      selectedCategoryId,
      searchQuery,
      handleSelect,
      toggleExpand,
    ]
  );

  return (
    <View className="flex-1">
      {/* Search input */}
      <View className="mx-1 mb-2 flex-row items-center rounded-xl border border-[#E2E8F0] bg-[#F7FAFF] px-3 py-2">
        <Search size={16} color="#94A3B8" />
        <TextInput
          className="ml-2 flex-1 text-base text-[#111827]"
          placeholder="Search categories..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Category tree */}
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        {filteredTree.length > 0 ? (
          filteredTree.map((node) => renderNode(node, 0))
        ) : (
          <View className="items-center py-8">
            <Text className="text-base text-[#94A3B8]">
              {searchQuery.trim()
                ? 'No categories match your search'
                : 'No categories available'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the category name with the matching substring bolded.
 * Uses a simple Text nesting approach compatible with React Native.
 */
function highlightMatch(name: string, query: string): React.ReactNode {
  const lower = name.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return name;

  const before = name.slice(0, idx);
  const match = name.slice(idx, idx + query.length);
  const after = name.slice(idx + query.length);

  return (
    <Text>
      {before}
      <Text className="font-bold text-[#2563EB]">{match}</Text>
      {after}
    </Text>
  );
}
