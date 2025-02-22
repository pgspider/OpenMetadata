/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import DashboardDetails from 'components/DashboardDetails/DashboardDetails.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { compare, Operation } from 'fast-json-patch';
import { isUndefined, omitBy, toString } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { updateChart } from 'rest/chartAPI';
import {
  addFollower,
  getDashboardByFqn,
  patchDashboardDetails,
  removeFollower,
} from 'rest/dashboardAPI';
import { postThread } from 'rest/feedsAPI';
import { getVersionPath } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import {
  addToRecentViewed,
  getCurrentUserId,
  getEntityMissingError,
} from '../../utils/CommonUtils';
import {
  defaultFields,
  fetchCharts,
  sortTagsForCharts,
} from '../../utils/DashboardDetailsUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

export type ChartType = {
  displayName: string;
} & Chart;

const DashboardDetailsPage = () => {
  const { t } = useTranslation();
  const USERId = getCurrentUserId();
  const history = useHistory();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { dashboardFQN } = useParams<{ dashboardFQN: string }>();
  const [dashboardDetails, setDashboardDetails] = useState<Dashboard>(
    {} as Dashboard
  );
  const [isLoading, setLoading] = useState<boolean>(false);
  const [charts, setCharts] = useState<ChartType[]>([]);
  const [isError, setIsError] = useState(false);

  const [dashboardPermissions, setDashboardPermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const { id: dashboardId, version } = dashboardDetails;

  const fetchResourcePermission = async (entityFqn: string) => {
    setLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.DASHBOARD,
        entityFqn
      );
      setDashboardPermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: entityFqn,
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const saveUpdatedDashboardData = (updatedData: Dashboard) => {
    const jsonPatch = compare(
      omitBy(dashboardDetails, isUndefined),
      updatedData
    );

    return patchDashboardDetails(dashboardId, jsonPatch);
  };

  const fetchDashboardDetail = async (dashboardFQN: string) => {
    setLoading(true);

    try {
      const res = await getDashboardByFqn(dashboardFQN, defaultFields);

      const { id, fullyQualifiedName, charts: ChartIds, serviceType } = res;
      setDashboardDetails(res);

      addToRecentViewed({
        displayName: getEntityName(res),
        entityType: EntityType.DASHBOARD,
        fqn: fullyQualifiedName ?? '',
        serviceType: serviceType,
        timestamp: 0,
        id: id,
      });

      fetchCharts(ChartIds)
        .then((chart) => {
          setCharts(chart);
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            t('server.entity-fetch-error', {
              entity: t('label.chart-plural'),
            })
          );
        });

      setLoading(false);
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        setIsError(true);
      } else {
        showErrorToast(
          error as AxiosError,
          t('server.entity-details-fetch-error', {
            entityType: t('label.dashboard'),
            entityName: dashboardFQN,
          })
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const onDashboardUpdate = async (
    updatedDashboard: Dashboard,
    key: keyof Dashboard
  ) => {
    try {
      const response = await saveUpdatedDashboardData(updatedDashboard);
      setDashboardDetails((previous) => {
        return {
          ...previous,
          version: response.version,
          [key]: response[key],
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const followDashboard = async () => {
    try {
      const res = await addFollower(dashboardId, USERId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      setDashboardDetails((prev) => ({
        ...prev,
        followers: [...(prev?.followers ?? []), ...newValue],
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(dashboardDetails),
        })
      );
    }
  };

  const unFollowDashboard = async () => {
    try {
      const res = await removeFollower(dashboardId, USERId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];

      setDashboardDetails((prev) => ({
        ...prev,
        followers:
          prev.followers?.filter(
            (follower) => follower.id !== oldValue[0].id
          ) ?? [],
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(dashboardDetails),
        })
      );
    }
  };

  const onChartUpdate = async (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => {
    try {
      const response = await updateChart(chartId, patch);
      setCharts((prevCharts) => {
        const charts = [...prevCharts];
        charts[index] = response;

        return charts;
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
  const handleChartTagSelection = async (
    chartId: string,
    patch: Array<Operation>
  ) => {
    try {
      const res = await updateChart(chartId, patch);

      setCharts((prevCharts) => {
        const charts = [...prevCharts].map((chart) =>
          chart.id === chartId ? res : chart
        );

        // Sorting tags as the response of PATCH request does not return the sorted order
        // of tags, but is stored in sorted manner in the database
        // which leads to wrong PATCH payload sent after further tags removal
        return sortTagsForCharts(charts);
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: t('label.chart-plural'),
        })
      );
    }
  };

  const versionHandler = () => {
    version &&
      history.push(
        getVersionPath(EntityType.DASHBOARD, dashboardFQN, toString(version))
      );
  };

  const createThread = async (data: CreateThread) => {
    try {
      await postThread(data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.conversation'),
        })
      );
    }
  };

  useEffect(() => {
    if (dashboardPermissions.ViewAll || dashboardPermissions.ViewBasic) {
      fetchDashboardDetail(dashboardFQN);
    }
  }, [dashboardFQN, dashboardPermissions]);

  useEffect(() => {
    fetchResourcePermission(dashboardFQN);
  }, [dashboardFQN]);

  if (isLoading) {
    return <Loader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('dashboard', dashboardFQN)}
      </ErrorPlaceHolder>
    );
  }
  if (!dashboardPermissions.ViewAll && !dashboardPermissions.ViewBasic) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <DashboardDetails
      chartDescriptionUpdateHandler={onChartUpdate}
      chartTagUpdateHandler={handleChartTagSelection}
      charts={charts}
      createThread={createThread}
      dashboardDetails={dashboardDetails}
      followDashboardHandler={followDashboard}
      unFollowDashboardHandler={unFollowDashboard}
      versionHandler={versionHandler}
      onDashboardUpdate={onDashboardUpdate}
    />
  );
};

export default DashboardDetailsPage;
