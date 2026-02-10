import { EditableText } from "./editable-text";
import { useAuth } from "../../lib/auth";

export type EditableDisplayNameProps = {
  displayName?: string | null;
  email?: string | null;
  canEdit?: boolean;
};

export function EditableDisplayName(props: EditableDisplayNameProps) {
  const auth = useAuth();
  const value = (props.displayName || "").trim() || props.email || "";
  const canEdit = props.canEdit ?? true;

  const handleSave = async (nextValue: string) => {
    await auth.updateDisplayName(nextValue);
  };

  return (
    <EditableText
      value={value}
      canEdit={canEdit}
      onSave={handleSave}
    />
  );
}
