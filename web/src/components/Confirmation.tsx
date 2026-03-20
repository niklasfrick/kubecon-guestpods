import type { SubmitResponse } from "../api";

interface Props {
  data: SubmitResponse;
}

export function Confirmation({ data }: Props) {
  return (
    <div class="card">
      <div class="confirmation">
        <div class="confirmation-check">{"\u2714"}</div>
        <h1>Pod deployed!</h1>
        <div class="confirmation-identity">
          {data.homelab_emoji} {data.name}
        </div>
        <div class="confirmation-namespace">
          ns/{data.country_code}
        </div>
        <div class="confirmation-status">
          <span class="status-dot" />
          Status: Running
        </div>
        <div class="confirmation-cta">
          Look up at the screen to find yourself!
        </div>
      </div>
    </div>
  );
}
