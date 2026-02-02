/**
 * Copyright (c) 2020-present, Goldman Sachs
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { type JSX, useState, useMemo, useCallback, useEffect } from 'react';
import {
  Autocomplete,
  Box,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Switch,
  TextField,
  Typography,
  type TextFieldProps,
} from '@mui/material';
import { clsx, SearchIcon, TuneIcon } from '@finos/legend-art';
import { observer } from 'mobx-react-lite';
import { LegendMarketplaceInfoTooltip } from '../InfoTooltip/LegendMarketplaceInfoTooltip.js';
import { LegendMarketplaceTelemetryHelper } from '../../__lib__/LegendMarketplaceTelemetryHelper.js';
import { useLegendMarketplaceBaseStore } from '../../application/providers/LegendMarketplaceFrameworkProvider.js';
import {
  createDefaultSuggestions,
  createAutosuggestSuggestions,
  type SearchSuggestion,
} from '../../utils/SearchSuggestions.js';
import { debounce, assertErrorThrown, LogEvent } from '@finos/legend-shared';
import { APPLICATION_EVENT } from '@finos/legend-application';
import { LEGEND_MARKETPLACE_APP_EVENT } from '../../__lib__/LegendMarketplaceAppEvent.js';

export interface Vendor {
  provider: string;
  description: string;
  type: string;
}

export const LegendMarketplaceSearchBar = observer(
  (props: {
    onSearch?: (query: string | undefined, useProducerSearch: boolean) => void;
    stateSearchQuery?: string | undefined;
    placeholder?: string;
    onChange?: (query: string) => void;
    className?: string | undefined;
    showSettings?: boolean;
    initialUseProducerSearch?: boolean;
    enableAutosuggest?: boolean;
  }): JSX.Element => {
    const {
      onSearch,
      stateSearchQuery,
      placeholder,
      onChange,
      className,
      showSettings,
      initialUseProducerSearch,
      enableAutosuggest = true,
    } = props;

    const legendMarketplaceBaseStore = useLegendMarketplaceBaseStore();
    const applicationStore = legendMarketplaceBaseStore.applicationStore;

    const [searchQuery, setSearchQuery] = useState<string>(initialValue ?? '');
    const [inputValue, setInputValue] = useState<string>(initialValue ?? '');
    const [useProducerSearch, setUseProducerSearch] = useState(
      stateUseProducerSearch ?? false,
    );
    const [searchMenuAnchorEl, setSearchMenuAnchorEl] =
      useState<HTMLElement | null>();
    const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [open, setOpen] = useState(false);

    const searchMenuOpen = Boolean(searchMenuAnchorEl);

    const defaultSuggestionsFromConfig =
      applicationStore.config.options.defaultSearchSuggestions;
    const shouldEnableAutosuggest = useMemo(
      () =>
        enableAutosuggest &&
        Boolean(
          defaultSuggestionsFromConfig &&
            defaultSuggestionsFromConfig.length > 0,
        ),
      [enableAutosuggest, defaultSuggestionsFromConfig],
    );

    const fetchAutosuggestions = useCallback(
      async (query: string): Promise<void> => {
        if (!shouldEnableAutosuggest) {
          setSuggestions([]);
          return;
        }

        if (!query || query.trim().length === 0) {
          setSuggestions(
            createDefaultSuggestions(defaultSuggestionsFromConfig),
          );
          return;
        }

        setLoadingSuggestions(true);
        try {
          const response =
            await legendMarketplaceBaseStore.marketplaceServerClient.getAutosuggestions(
              query,
              legendMarketplaceBaseStore.envState.lakehouseEnvironment,
              5,
            );

          const results = response.results;
          if (results.length > 0) {
            setSuggestions(createAutosuggestSuggestions(results));
          } else {
            setSuggestions(
              createDefaultSuggestions(defaultSuggestionsFromConfig),
            );
          }
        } catch (error) {
          assertErrorThrown(error);
          applicationStore.logService.error(
            LogEvent.create(APPLICATION_EVENT.GENERIC_FAILURE),
            error,
          );
          setSuggestions(
            createDefaultSuggestions(defaultSuggestionsFromConfig),
          );
        } finally {
          setLoadingSuggestions(false);
        }
      },
      [
        shouldEnableAutosuggest,
        defaultSuggestionsFromConfig,
        legendMarketplaceBaseStore.marketplaceServerClient,
        legendMarketplaceBaseStore.envState.lakehouseEnvironment,
        applicationStore.logService,
      ],
    );

    const debouncedFetchAutosuggestions = useMemo(
      () => debounce(fetchAutosuggestions, 300),
      [fetchAutosuggestions],
    );

    useEffect(() => {
      if (open) {
        if (!inputValue || inputValue.trim().length === 0) {
          setSuggestions(
            createDefaultSuggestions(defaultSuggestionsFromConfig),
          );
        } else {
          // eslint-disable-next-line no-void
          void debouncedFetchAutosuggestions(inputValue);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputValue, open, debouncedFetchAutosuggestions]);

    const handleInputChange = (
      _event: React.SyntheticEvent,
      newInputValue: string,
    ): void => {
      setInputValue(newInputValue);
      onChange?.(newInputValue);
    };

    const handleChange = (
      _event: React.SyntheticEvent,
      newValue: SearchSuggestion | string | null,
    ): void => {
      if (typeof newValue === 'string') {
        setSearchQuery(newValue);
        setInputValue(newValue);
      } else if (newValue) {
        const query = newValue.query;
        setSearchQuery(query);
        setInputValue(query);
        onSearch?.(query, useProducerSearch);

        if (newValue.type === 'autosuggest') {
          LegendMarketplaceTelemetryHelper.logEvent_SearchAutosuggestSelection(
            applicationStore.telemetryService,
            query,
          );
        } else {
          applicationStore.telemetryService.logEvent(
            LEGEND_MARKETPLACE_APP_EVENT.SEARCH_AUTOSUGGEST_SELECTION,
            {
              query,
              suggestionType: 'default',
            },
          );
        }
      }
    };

    const handleSubmit = (event: React.FormEvent): void => {
      event.preventDefault();
      onSearch?.(inputValue || searchQuery, useProducerSearch);
    };

    const getOptionLabel = (option: SearchSuggestion | string): string => {
      if (typeof option === 'string') {
        return option;
      }
      return option.query;
    };

    const filterOptions = (options: SearchSuggestion[]): SearchSuggestion[] => {
      return options;
    };

    return (
      <form
        className={clsx('legend-marketplace__search-bar', className)}
        onSubmit={handleSubmit}
      >
        <Autocomplete
          freeSolo={true}
          fullWidth={true}
          open={shouldEnableAutosuggest ? open : false}
          onOpen={() => {
            if (shouldEnableAutosuggest) {
              setOpen(true);
            }
          }}
          onClose={() => {
            setOpen(false);
          }}
          value={null}
          inputValue={inputValue}
          onInputChange={handleInputChange}
          onChange={handleChange}
          options={suggestions}
          loading={loadingSuggestions}
          filterOptions={filterOptions}
          getOptionLabel={getOptionLabel}
          componentsProps={{
            popper: {
              className: 'legend-marketplace__search-bar__dropdown',
              modifiers: [
                {
                  name: 'offset',
                  options: {
                    offset: [0, 4],
                  },
                },
                {
                  name: 'sameWidth',
                  enabled: true,
                  phase: 'beforeWrite',
                  requires: ['computeStyles'],
                  fn: ({ state }) => {
                    if (state.styles.popper) {
                      state.styles.popper.width = `${state.rects.reference.width}px`;
                    }
                  },
                  effect: ({ state }) => {
                    const referenceWidth = (
                      state.elements.reference as HTMLElement
                    ).offsetWidth;
                    state.elements.popper.style.width = `${referenceWidth}px`;
                  },
                },
              ],
              placement: 'bottom-start',
            },
          }}
          groupBy={(option) => {
            if (typeof option === 'string') {
              return '';
            }
            return option.type === 'default'
              ? 'Suggested Searches'
              : 'Suggestions';
          }}
          renderGroup={(params) => (
            <Box key={params.key}>
              {params.group && (
                <Typography className="legend-marketplace__search-bar__autocomplete-group-header">
                  {params.group}
                </Typography>
              )}
              {params.children}
            </Box>
          )}
          renderOption={(params, option) => {
            if (typeof option === 'string') {
              return (
                <Box component="li" {...params} key={option}>
                  <Typography className="legend-marketplace__search-bar__autocomplete-option__text">
                    {option}
                  </Typography>
                </Box>
              );
            }

            if (option.type === 'default') {
              return (
                <Box
                  component="li"
                  {...params}
                  key={option.query}
                  className="legend-marketplace__search-bar__autocomplete-option"
                >
                  <Typography className="legend-marketplace__search-bar__autocomplete-option__text">
                    {option.query}
                  </Typography>
                </Box>
              );
            }

            const result = option.autosuggestResult;
            if (!result) {
              return null;
            }

            const description = result.dataProductDescription;

            return (
              <Box
                component="li"
                {...params}
                key={result.dataProductName}
                className="legend-marketplace__search-bar__autocomplete-option"
              >
                <div className="legend-marketplace__search-bar__autocomplete-option__content">
                  <span className="legend-marketplace__search-bar__autocomplete-option__name">
                    {result.dataProductName}
                  </span>
                  {description && (
                    <>
                      <span className="legend-marketplace__search-bar__autocomplete-option__separator">
                        {' | '}
                      </span>
                      <span className="legend-marketplace__search-bar__autocomplete-option__description">
                        {description}
                      </span>
                    </>
                  )}
                </div>
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...(params as TextFieldProps)}
              className="legend-marketplace__search-bar__text-field"
              placeholder={placeholder ?? 'Search'}
              fullWidth={true}
              slotProps={{
                input: {
                  ...params.InputProps,
                  className: 'legend-marketplace__search-bar__input',
                  endAdornment: (
                    <>
                      {loadingSuggestions ? (
                        <CircularProgress color="inherit" size={20} />
                      ) : null}
                      {params.InputProps.endAdornment}
                      <InputAdornment position="end">
                        {showSettings && (
                          <IconButton
                            onClick={(event) =>
                              setSearchMenuAnchorEl(event.currentTarget)
                            }
                            title="Search settings"
                            className="legend-marketplace__search-bar__settings-icon"
                          >
                            <TuneIcon />
                          </IconButton>
                        )}
                        <IconButton
                          type="submit"
                          title="Search"
                          className="legend-marketplace__search-bar__search-icon"
                        >
                          <SearchIcon />
                        </IconButton>
                      </InputAdornment>
                    </>
                  ),
                },
              }}
            />
          )}
        />
        {showSettings && (
          <Menu
            anchorEl={searchMenuAnchorEl}
            open={searchMenuOpen}
            onClose={() => setSearchMenuAnchorEl(null)}
          >
            <MenuItem>
              <FormControlLabel
                control={
                  <Switch
                    checked={useProducerSearch}
                    onChange={(event) => {
                      setUseProducerSearch(event.target.checked);
                      LegendMarketplaceTelemetryHelper.logEvent_ToggleProducerSearch(
                        applicationStore.telemetryService,
                        event.target.checked,
                      );
                    }}
                  />
                }
                label={
                  <>
                    Producer Search{' '}
                    <LegendMarketplaceInfoTooltip title="Use this search if you have just created a data product and would like to immediately see it" />
                  </>
                }
              />
            </MenuItem>
          </Menu>
        )}
      </form>
    );
  },
);
