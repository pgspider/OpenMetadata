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

import { DownOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Dropdown,
  Form,
  Menu,
  MenuProps,
  Row,
  Select,
  Space,
  Tooltip,
} from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { ReactComponent as DropDownIcon } from 'assets/svg/DropDown.svg';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { SummaryCard } from 'components/common/SummaryCard/SummaryCard.component';
import { SummaryCardProps } from 'components/common/SummaryCard/SummaryCard.interface';
import DatePickerMenu from 'components/DatePickerMenu/DatePickerMenu.component';
import { DateRangeObject } from 'components/ProfilerDashboard/component/TestSummary';
import { useTourProvider } from 'components/TourProvider/TourProvider';
import { mockDatasetData } from 'constants/mockTourData.constants';
import { Column } from 'generated/entity/data/container';
import {
  filter,
  find,
  groupBy,
  isEmpty,
  isEqual,
  isUndefined,
  map,
  toLower,
} from 'lodash';
import Qs from 'qs';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import { getLatestTableProfileByFqn } from 'rest/tableAPI';
import { getListTestCase, ListTestCaseParams } from 'rest/testAPI';
import { ReactComponent as ColumnProfileIcon } from '../../assets/svg/column-profile.svg';
import { ReactComponent as DataQualityIcon } from '../../assets/svg/data-quality.svg';
import { ReactComponent as SettingIcon } from '../../assets/svg/ic-settings-primery.svg';
import { ReactComponent as NoDataIcon } from '../../assets/svg/no-data-icon.svg';
import { ReactComponent as TableProfileIcon } from '../../assets/svg/table-profile.svg';
import { API_RES_MAX_SIZE } from '../../constants/constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import {
  allowedServiceForOperationGraph,
  DEFAULT_RANGE_DATA,
  INITIAL_TEST_RESULT_SUMMARY,
} from '../../constants/profiler.constant';
import { ProfilerDashboardType } from '../../enums/table.enum';
import { ProfileSampleType, Table } from '../../generated/entity/data/table';
import { TestCase, TestCaseStatus } from '../../generated/tests/testCase';
import { EntityType as TestType } from '../../generated/tests/testDefinition';
import { updateTestResults } from '../../utils/DataQualityAndProfilerUtils';
import { getAddDataQualityTableTestPath } from '../../utils/RouterUtils';
import { generateEntityLink } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import PageHeader from '../header/PageHeader.component';
import { TableProfilerTab } from '../ProfilerDashboard/profilerDashboard.interface';
import ColumnPickerMenu from './Component/ColumnPickerMenu';
import ColumnProfileTable from './Component/ColumnProfileTable';
import ColumnSummary from './Component/ColumnSummary';
import ProfilerSettingsModal from './Component/ProfilerSettingsModal';
import TableProfilerChart from './Component/TableProfilerChart';
import { QualityTab } from './QualityTab/QualityTab.component';
import {
  OverallTableSummeryType,
  TableProfilerProps,
  TableTestsType,
} from './TableProfiler.interface';
import './tableProfiler.less';

const TableProfilerV1: FC<TableProfilerProps> = ({
  testSuite,
  isTableDeleted,
  permissions,
}: TableProfilerProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const { isTourOpen } = useTourProvider();

  const {
    activeTab = isTourOpen
      ? TableProfilerTab.COLUMN_PROFILE
      : TableProfilerTab.TABLE_PROFILE,
    activeColumnFqn,
  } = useMemo(() => {
    const param = location.search;
    const searchData = Qs.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as { activeTab: string; activeColumnFqn: string };
  }, [location.search, isTourOpen]);

  const { datasetFQN } = useParams<{ datasetFQN: string }>();
  const [table, setTable] = useState<Table>();
  const { profile, columns } = useMemo(() => {
    return { profile: table?.profile, columns: table?.columns || [] };
  }, [table]);
  const [settingModalVisible, setSettingModalVisible] = useState(false);
  const [columnTests, setColumnTests] = useState<TestCase[]>([]);
  const [tableTests, setTableTests] = useState<TableTestsType>({
    tests: [],
    results: INITIAL_TEST_RESULT_SUMMARY,
  });

  const [selectedTestCaseStatus, setSelectedTestCaseStatus] =
    useState<string>('');
  const [selectedTestType, setSelectedTestType] = useState('');
  const [isTestCaseLoading, setIsTestCaseLoading] = useState(false);
  const [dateRangeObject, setDateRangeObject] =
    useState<DateRangeObject>(DEFAULT_RANGE_DATA);

  const showOperationGraph = useMemo(() => {
    if (table && table.serviceType) {
      return allowedServiceForOperationGraph.includes(table.serviceType);
    }

    return false;
  }, [table]);

  const isColumnProfile = activeTab === TableProfilerTab.COLUMN_PROFILE;
  const isDataQuality = activeTab === TableProfilerTab.DATA_QUALITY;
  const isTableProfile = activeTab === TableProfilerTab.TABLE_PROFILE;

  const updateActiveTab = (key: string) =>
    history.push({ search: Qs.stringify({ activeTab: key }) });

  const testCaseStatusOption = useMemo(() => {
    const testCaseStatus: DefaultOptionType[] = Object.values(
      TestCaseStatus
    ).map((value) => ({
      label: value,
      value: value,
    }));
    testCaseStatus.unshift({
      label: t('label.all'),
      value: '',
    });

    return testCaseStatus;
  }, []);

  const getPageHeader = useMemo(() => {
    if (isTableProfile) {
      return PAGE_HEADERS.TABLE_PROFILE;
    } else if (isDataQuality) {
      return PAGE_HEADERS.DATA_QUALITY;
    } else {
      return {
        ...PAGE_HEADERS.COLUMN_PROFILE,
        header: isEmpty(activeColumnFqn) ? (
          PAGE_HEADERS.COLUMN_PROFILE.header
        ) : (
          <Button
            className="p-0 text-md font-medium"
            type="link"
            onClick={() => updateActiveTab(TableProfilerTab.COLUMN_PROFILE)}>
            <Space>
              <DropDownIcon className="transform-90" height={16} width={16} />
              {PAGE_HEADERS.COLUMN_PROFILE.header}
            </Space>
          </Button>
        ),
      };
    }
  }, [isTableProfile, isDataQuality, activeColumnFqn]);

  const testCaseTypeOption = useMemo(() => {
    const testCaseStatus: DefaultOptionType[] = map(TestType, (value, key) => ({
      label: key,
      value: value,
    }));
    testCaseStatus.unshift({
      label: t('label.all'),
      value: '',
    });

    return testCaseStatus;
  }, []);

  const viewTest =
    permissions.ViewAll || permissions.ViewBasic || permissions.ViewTests;
  const viewProfiler =
    permissions.ViewAll || permissions.ViewBasic || permissions.ViewDataProfile;
  const editTest = permissions.EditAll || permissions.EditTests;

  const handleSettingModal = (value: boolean) => {
    setSettingModalVisible(value);
  };

  const getProfileSampleValue = () => {
    let value;
    if (profile?.profileSampleType === ProfileSampleType.Percentage) {
      value = `${profile?.profileSample ?? 100}%`;
    } else if (profile?.profileSampleType === ProfileSampleType.Rows) {
      value = `${profile?.profileSample} ${
        profile?.profileSampleType.toString().length > 1
          ? t('label.row-plural')
          : t('label.row')
      } `;
    } else {
      value = '100%';
    }

    return value;
  };

  const overallSummery: OverallTableSummeryType[] = useMemo(() => {
    return [
      {
        title: t('label.entity-count', {
          entity: t('label.row'),
        }),
        value: profile?.rowCount ?? 0,
      },
      {
        title: t('label.column-entity', {
          entity: t('label.count'),
        }),
        value: profile?.columnCount ?? table?.columns.length ?? 0,
      },
      {
        title: `${t('label.profile-sample-type', { type: '' })}`,
        value: getProfileSampleValue(),
      },
    ];
  }, [profile, tableTests]);

  const tabOptions = [
    {
      label: t('label.table-entity-text', {
        entityText: t('label.profile'),
      }),
      key: TableProfilerTab.TABLE_PROFILE,
      disabled: !viewProfiler,
      icon: <TableProfileIcon />,
    },
    {
      label: t('label.column-entity', {
        entity: t('label.profile'),
      }),
      key: TableProfilerTab.COLUMN_PROFILE,
      disabled: !viewProfiler,
      icon: <ColumnProfileIcon />,
    },
    {
      label: t('label.data-entity', {
        entity: t('label.quality'),
      }),
      key: TableProfilerTab.DATA_QUALITY,
      disabled: !viewTest,
      icon: <DataQualityIcon />,
    },
  ];

  const handleAddTestClick = (type: ProfilerDashboardType) => {
    history.push(
      getAddDataQualityTableTestPath(type, `${table?.fullyQualifiedName}`)
    );
  };

  const addButtonContent = [
    {
      label: t('label.table'),
      key: '1',
      onClick: () => handleAddTestClick(ProfilerDashboardType.TABLE),
    },
    {
      label: t('label.column'),
      key: '2',
      onClick: () => handleAddTestClick(ProfilerDashboardType.COLUMN),
    },
  ];

  const updateActiveColumnFqn = (key: string) =>
    history.push({ search: Qs.stringify({ activeColumnFqn: key, activeTab }) });

  const handleTabChange: MenuProps['onClick'] = (value) => {
    updateActiveTab(value.key);
  };

  useEffect(() => {
    if (isUndefined(activeTab)) {
      updateActiveTab(
        isTourOpen
          ? TableProfilerTab.COLUMN_PROFILE
          : TableProfilerTab.TABLE_PROFILE
      );
    }
  }, [isTourOpen]);

  const handleResultUpdate = (testCase: TestCase) => {
    setTableTests((prev) => {
      const tests = prev.tests.map((test) => {
        if (test.fullyQualifiedName === testCase.fullyQualifiedName) {
          return testCase;
        }

        return test;
      });

      return {
        ...prev,
        tests,
      };
    });
  };

  const handleDateRangeChange = (value: DateRangeObject) => {
    if (!isEqual(value, dateRangeObject)) {
      setDateRangeObject(value);
    }
  };

  const fetchAllTests = async (params?: ListTestCaseParams) => {
    setIsTestCaseLoading(true);
    try {
      const { data } = await getListTestCase({
        fields: 'testCaseResult,entityLink,testDefinition,testSuite',
        entityLink: generateEntityLink(table?.fullyQualifiedName || ''),
        includeAllTests: true,
        limit: API_RES_MAX_SIZE,
        ...params,
      });
      const columnTestsCase: TestCase[] = [];
      const tableTests: TableTestsType = {
        tests: [],
        results: { ...INITIAL_TEST_RESULT_SUMMARY },
      };
      data.forEach((test) => {
        if (test.entityFQN === table?.fullyQualifiedName) {
          tableTests.tests.push(test);

          updateTestResults(
            tableTests.results,
            test.testCaseResult?.testCaseStatus || ''
          );

          return;
        }
        columnTestsCase.push(test);
      });
      setTableTests(tableTests);
      setColumnTests(columnTestsCase);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsTestCaseLoading(false);
    }
  };

  const handleTestCaseStatusChange = (value: string) => {
    if (value !== selectedTestCaseStatus) {
      setSelectedTestCaseStatus(value);
    }
  };

  const handleTestCaseTypeChange = (value: string) => {
    if (value !== selectedTestType) {
      setSelectedTestType(value);
    }
  };

  const getFilterTestCase = () => {
    let tests: TestCase[] = [];
    if (selectedTestType === TestType.Table) {
      tests = tableTests.tests;
    } else if (selectedTestType === TestType.Column) {
      tests = columnTests;
    } else {
      tests = [...tableTests.tests, ...columnTests];
    }

    return tests.filter(
      (data) =>
        selectedTestCaseStatus === '' ||
        data.testCaseResult?.testCaseStatus === selectedTestCaseStatus
    );
  };

  const fetchLatestProfilerData = async () => {
    // As we are encoding the fqn in API function to apply all over the application
    // and the datasetFQN comes form url parameter which is already encoded,
    // we are decoding FQN below to avoid double encoding in the API function
    const decodedDatasetFQN = decodeURIComponent(datasetFQN);
    try {
      const response = await getLatestTableProfileByFqn(decodedDatasetFQN);
      setTable(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const selectedColumn = useMemo(() => {
    return find(
      columns,
      (column: Column) => column.fullyQualifiedName === activeColumnFqn
    );
  }, [columns, activeColumnFqn]);

  const selectedColumnTestsObj = useMemo(() => {
    const temp = filter(
      columnTests,
      (test: TestCase) => test.entityFQN === activeColumnFqn
    );

    const statusDict = {
      [TestCaseStatus.Success]: [],
      [TestCaseStatus.Aborted]: [],
      [TestCaseStatus.Failed]: [],
      ...groupBy(temp, 'testCaseResult.testCaseStatus'),
    };

    return { statusDict, totalTests: temp.length };
  }, [activeColumnFqn, columnTests]);

  useEffect(() => {
    if (!isUndefined(table) && viewTest && !isTourOpen) {
      fetchAllTests();
    }
  }, [table, viewTest, isTourOpen]);

  useEffect(() => {
    if (!isTableDeleted && datasetFQN && !isTourOpen) {
      fetchLatestProfilerData();
    }
    if (isTourOpen) {
      setTable(mockDatasetData.tableDetails as unknown as Table);
    }
  }, [datasetFQN, isTourOpen]);

  return (
    <Row
      className="table-profiler-container h-full flex-grow"
      data-testid="table-profiler-container"
      gutter={[16, 16]}
      id="profilerDetails">
      <Col className="p-t-sm data-quality-left-panel" span={4}>
        <Menu
          className="h-full p-x-0 custom-menu"
          data-testid="profiler-tab-left-panel"
          items={tabOptions}
          mode="inline"
          selectedKeys={[activeTab ?? TableProfilerTab.TABLE_PROFILE]}
          onClick={handleTabChange}
        />
      </Col>
      <Col className="data-quality-content-panel" span={20}>
        <Space
          className="w-full h-min-full p-sm"
          direction="vertical"
          size={16}>
          <Row>
            <Col span={10}>
              <PageHeader data={getPageHeader} />
            </Col>
            <Col span={14}>
              <Space align="center" className="w-full justify-end">
                {isDataQuality && (
                  <>
                    <Form.Item className="m-0 w-40" label={t('label.type')}>
                      <Select
                        options={testCaseTypeOption}
                        value={selectedTestType}
                        onChange={handleTestCaseTypeChange}
                      />
                    </Form.Item>
                    <Form.Item className="m-0 w-40" label={t('label.status')}>
                      <Select
                        options={testCaseStatusOption}
                        value={selectedTestCaseStatus}
                        onChange={handleTestCaseStatusChange}
                      />
                    </Form.Item>
                  </>
                )}

                {(isTableProfile || !isEmpty(activeColumnFqn)) && (
                  <DatePickerMenu
                    showSelectedCustomRange
                    handleDateRangeChange={handleDateRangeChange}
                  />
                )}
                {!isEmpty(activeColumnFqn) && (
                  <ColumnPickerMenu
                    activeColumnFqn={activeColumnFqn}
                    columns={columns}
                    handleChange={updateActiveColumnFqn}
                  />
                )}

                <Tooltip
                  title={!editTest && t('message.no-permission-for-action')}>
                  <Dropdown
                    menu={{
                      items: addButtonContent,
                    }}
                    placement="bottomRight"
                    trigger={['click']}>
                    <Button
                      data-testid="profiler-add-table-test-btn"
                      disabled={!editTest}
                      type="primary">
                      <Space>
                        {t('label.add-entity', { entity: t('label.test') })}
                        <DownOutlined />
                      </Space>
                    </Button>
                  </Dropdown>
                </Tooltip>

                <Tooltip
                  placement="topRight"
                  title={
                    editTest
                      ? t('label.setting-plural')
                      : t('message.no-permission-for-action')
                  }>
                  <Button
                    data-testid="profiler-setting-btn"
                    disabled={!editTest}
                    onClick={() => handleSettingModal(true)}>
                    <SettingIcon className="self-center" />
                  </Button>
                </Tooltip>
              </Space>
            </Col>
          </Row>

          {isUndefined(profile) && !isDataQuality && (
            <div
              className="tw-border d-flex tw-items-center tw-border-warning tw-rounded tw-p-2 tw-mb-4"
              data-testid="no-profiler-placeholder">
              <NoDataIcon />
              <p className="tw-mb-0 tw-ml-2">
                {t('message.no-profiler-message')}
                <Link
                  className="tw-ml-1"
                  target="_blank"
                  to={{
                    pathname:
                      'https://docs.open-metadata.org/connectors/ingestion/workflows/profiler',
                  }}>
                  {`${t('label.here-lowercase')}.`}
                </Link>
              </p>
            </div>
          )}

          <Row gutter={[16, 16]}>
            {!isUndefined(selectedColumn) && (
              <Col span={10}>
                <ColumnSummary column={selectedColumn} />
              </Col>
            )}
            {!isDataQuality && (
              <Col span={selectedColumn ? 14 : 24}>
                <Row wrap gutter={[16, 16]}>
                  {overallSummery.map((summery) => (
                    <Col
                      key={summery.title}
                      span={selectedColumn ? undefined : 8}>
                      <SummaryCard
                        className={classNames(summery.className, 'h-full')}
                        showProgressBar={false}
                        title={summery.title}
                        total={0}
                        value={summery.value}
                      />
                    </Col>
                  ))}
                  {!isEmpty(activeColumnFqn) &&
                    map(selectedColumnTestsObj.statusDict, (data, key) => (
                      <Col key={key}>
                        <SummaryCard
                          showProgressBar
                          title={key}
                          total={selectedColumnTestsObj.totalTests}
                          type={toLower(key) as SummaryCardProps['type']}
                          value={data.length}
                        />
                      </Col>
                    ))}
                </Row>
              </Col>
            )}
          </Row>

          {isColumnProfile && (
            <ColumnProfileTable
              columnTests={columnTests}
              columns={columns.map((col) => ({
                ...col,
                key: col.name,
              }))}
              dateRangeObject={dateRangeObject}
              hasEditAccess={editTest}
            />
          )}

          {isDataQuality && (
            <QualityTab
              isLoading={isTestCaseLoading}
              showTableColumn={false}
              testCases={getFilterTestCase()}
              testSuite={testSuite}
              onTestCaseResultUpdate={handleResultUpdate}
              onTestUpdate={fetchAllTests}
            />
          )}

          {isTableProfile && (
            <TableProfilerChart
              dateRangeObject={dateRangeObject}
              showOperationGraph={showOperationGraph}
            />
          )}

          {settingModalVisible && (
            <ProfilerSettingsModal
              columns={columns}
              tableId={table?.id || ''}
              visible={settingModalVisible}
              onVisibilityChange={handleSettingModal}
            />
          )}
        </Space>
      </Col>
    </Row>
  );
};

export default TableProfilerV1;
