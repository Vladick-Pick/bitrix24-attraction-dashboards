# Workflow: New Report Block

Owner: `Dashboard Engineering Manager`; implementation usually split between `Data/Backend` and `Frontend`.

```mermaid
flowchart TD
  A["Report block request"] --> B["Confirm module ontology and metric definition"]
  B --> C["Define data contract and privacy constraints"]
  C --> D["Backend/reporting implementation"]
  C --> E["Frontend layout implementation"]
  D --> F["Contract tests"]
  E --> G["UI tests and screenshot check"]
  F --> H["Fresh verifier"]
  G --> H
  H --> I["Review and release gate"]
```

## Required Spec

- business question answered by the block;
- exact metric definitions;
- source tables/fields;
- period/filter behavior;
- empty/loading/error states;
- privacy constraints;
- acceptance criteria for desktop and mobile.

## Privacy

Report blocks must use aggregate or ID-only data. Do not persist or display deal names, contact names, phones, emails, comments, or raw Bitrix payloads.
