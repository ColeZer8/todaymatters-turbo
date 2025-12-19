# Supabase Team Call Agenda

**Quick Reference for Your Call**

---

## 🎯 Critical Requests (Must Have)

### 1. **Expose `tm` Schema in API Settings** ⚠️ BLOCKER
**What**: The `tm` schema needs to be exposed so our app can query it via the Supabase client.

**Step-by-Step Instructions**:
1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/bqbbuysyiyzdtftctvdk
2. Click **Settings** (gear icon in left sidebar)
3. Click **API** in the settings menu
4. Scroll down to **Data API Settings** section
5. Find the **Exposed schemas** field (it's a text input/textarea)
6. Currently it should show: `public`
7. Change it to: `public, tm` (or just `tm` if you want to remove public)
8. Click **Save** at the bottom

**Visual Guide**:
```
Dashboard → Settings → API → Data API Settings → Exposed schemas
```

**What it looks like**:
```
Exposed schemas: [public, tm]
```

**Why**: Our app is configured to use `tm` schema, but queries fail if it's not exposed. Without this, all `.schema('tm')` queries will return errors.

---

### 2. **Create `profile_values` Table** ⚠️ BLOCKER
**What**: Create the `profile_values` table in the `tm` schema.

**SQL File**: `docs/profile-values-table-ddl.sql` (complete DDL ready)

**Quick Summary**:
```sql
CREATE TABLE tm.profile_values (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    value_label TEXT NOT NULL,
    rank INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

**Includes**: Indexes, RLS policies, triggers, permissions - everything is in the DDL file.

**Why**: We have the service code ready, just need the table to exist.

---

### 3. **Add `role` Column to `profiles` Table**
**What**: Add a `role TEXT` column to `tm.profiles` table.

**SQL**:
```sql
ALTER TABLE tm.profiles ADD COLUMN role TEXT;
```

**Why**: We need to store the user's role selection from onboarding (e.g., "Professional", "Student", "Parent").

---

## 🤔 Questions to Ask (Nice to Have)

### 4. **Ideal Day Schema Clarification**
**Current**: `tm.ideal_day` table exists with:
- `user_id`, `category_id`, `day_type`, `minutes`

**Missing**: 
- `category_name` (text)
- `color` (text)
- `max_minutes` (integer)
- `selected_days` (jsonb) for custom day types

**Question**: 
- Should we add these columns to `ideal_day`?
- Or is there a separate `ideal_day_categories` table we should use?
- What's the structure of `category_id` - is it a foreign key or just an identifier?

---

### 5. **Auto-Create Profile on Signup**
**Question**: Can we set up a database trigger to automatically create a profile record in `tm.profiles` when a user signs up?

**SQL** (if they say yes):
```sql
CREATE OR REPLACE FUNCTION tm.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tm.profiles (user_id, timezone)
  VALUES (NEW.id, 'UTC');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION tm.handle_new_user();
```

---

## 📋 Quick Checklist for Call

- [ ] **Expose `tm` schema** in API settings
- [ ] **Create `profile_values` table** (use DDL from `docs/profile-values-table-ddl.sql`)
- [ ] **Add `role` column** to `tm.profiles`
- [ ] **Clarify Ideal Day schema** structure
- [ ] **Discuss auto-profile creation** trigger (optional)

---

## 🗣️ What to Say

**Opening**: "We're ready to integrate our mobile app with Supabase. We have a few blockers and questions."

**For Schema Exposure**:
> "Our app uses the `tm` schema instead of `public`. Can you expose the `tm` schema in the API settings so our client can query it? It's currently not exposed, which is blocking our queries."

**For Profile Values Table**:
> "We need the `profile_values` table created in the `tm` schema. We have the complete DDL ready with indexes, RLS policies, and triggers. The file is at `docs/profile-values-table-ddl.sql`. Can you run that migration?"

**For Role Column**:
> "We need to add a `role TEXT` column to the `tm.profiles` table to store the user's role selection from onboarding. Can you add that?"

**For Ideal Day**:
> "We're looking at the `ideal_day` table and need to store category metadata like name, color, and max hours. Should we add columns to the existing table, or is there a different structure we should use?"

---

## 📁 Files to Reference

- **Profile Values DDL**: `docs/profile-values-table-ddl.sql`
- **Integration Plan**: `docs/supabase-tm-schema-integration-plan.md`
- **Schema Analysis**: `docs/supabase-schema-analysis.md`
- **Implementation Roadmap**: `docs/supabase-implementation-roadmap.md`

---

## ⚡ After the Call

1. **Test schema exposure**: Try a query to `tm.profiles` to verify it works
2. **Test profile_values**: Try inserting/fetching profile values
3. **Update documentation**: Note any schema decisions made
4. **Start building**: Begin implementing services once blockers are resolved

---

## 🚨 If They Push Back

**If they say "use public schema"**:
- Explain that `tm` schema is already in use throughout the codebase
- All queries use `.schema('tm')` explicitly
- Changing would require refactoring the entire app

**If they say "we'll do it later"**:
- Emphasize that schema exposure is a blocker for all data operations
- Profile values table is needed for a core feature (user values)
- These are quick fixes that unblock development

---

**Good luck! 🎯**

