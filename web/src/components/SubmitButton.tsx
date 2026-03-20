interface Props {
  loading: boolean;
  disabled: boolean;
}

export function SubmitButton({ loading, disabled }: Props) {
  return (
    <button
      type="submit"
      class="submit-btn"
      disabled={loading || disabled}
    >
      {loading ? (
        <>
          <span class="spinner" />
          Deploying...
        </>
      ) : (
        "kubectl apply"
      )}
    </button>
  );
}
