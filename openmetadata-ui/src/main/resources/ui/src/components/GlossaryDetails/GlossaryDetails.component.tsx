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

import { Col, Row, Space } from 'antd';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import GlossaryHeader from 'components/Glossary/GlossaryHeader/GlossaryHeader.component';
import GlossaryTermTab from 'components/Glossary/GlossaryTermTab/GlossaryTermTab.component';
import GlossaryDetailsRightPanel from 'components/GlossaryDetailsRightPanel/GlossaryDetailsRightPanel.component';
import { EntityField } from 'constants/Feeds.constants';
import { EntityType } from 'enums/entity.enum';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import { ChangeDescription } from 'generated/entity/type';
import React, { useMemo, useState } from 'react';
import { getEntityVersionByField } from 'utils/EntityVersionUtils';
import { Glossary } from '../../generated/entity/data/glossary';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';
import './GlossaryDetails.style.less';

type props = {
  isVersionView?: boolean;
  permissions: OperationPermission;
  glossary: Glossary;
  glossaryTerms: GlossaryTerm[];
  termsLoading: boolean;
  updateGlossary: (value: Glossary) => Promise<void>;
  handleGlossaryDelete: (id: string) => void;
  refreshGlossaryTerms: () => void;
  onAddGlossaryTerm: (glossaryTerm: GlossaryTerm | undefined) => void;
  onEditGlossaryTerm: (glossaryTerm: GlossaryTerm) => void;
};

const GlossaryDetails = ({
  permissions,
  glossary,
  updateGlossary,
  handleGlossaryDelete,
  glossaryTerms,
  termsLoading,
  refreshGlossaryTerms,
  onAddGlossaryTerm,
  onEditGlossaryTerm,
  isVersionView,
}: props) => {
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (glossary.description !== updatedHTML) {
      const updatedTableDetails = {
        ...glossary,
        description: updatedHTML,
      };
      updateGlossary(updatedTableDetails);
      setIsDescriptionEditable(false);
    } else {
      setIsDescriptionEditable(false);
    }
  };

  const description = useMemo(
    () =>
      isVersionView
        ? getEntityVersionByField(
            glossary.changeDescription as ChangeDescription,
            EntityField.DESCRIPTION,
            glossary.description
          )
        : glossary.description,

    [glossary, isVersionView]
  );

  const name = useMemo(
    () =>
      isVersionView
        ? getEntityVersionByField(
            glossary.changeDescription as ChangeDescription,
            EntityField.NAME,
            glossary.name
          )
        : glossary.name,

    [glossary, isVersionView]
  );

  const displayName = useMemo(
    () =>
      isVersionView
        ? getEntityVersionByField(
            glossary.changeDescription as ChangeDescription,
            EntityField.DISPLAYNAME,
            glossary.displayName
          )
        : glossary.displayName,

    [glossary, isVersionView]
  );

  return (
    <Row
      className="glossary-details"
      data-testid="glossary-details"
      gutter={[0, 16]}>
      <Col span={24}>
        <GlossaryHeader
          isGlossary
          isVersionView={isVersionView}
          permissions={permissions}
          selectedData={{ ...glossary, displayName, name }}
          onAddGlossaryTerm={onAddGlossaryTerm}
          onDelete={handleGlossaryDelete}
          onUpdate={updateGlossary}
        />
      </Col>

      <Col span={24}>
        <Row gutter={[16, 16]}>
          <Col span={18}>
            <Space className="w-full" direction="vertical" size={24}>
              <DescriptionV1
                wrapInCard
                description={description}
                entityName={glossary.displayName ?? glossary.name}
                entityType={EntityType.GLOSSARY}
                hasEditAccess={
                  permissions.EditDescription || permissions.EditAll
                }
                isEdit={isDescriptionEditable}
                onCancel={() => setIsDescriptionEditable(false)}
                onDescriptionEdit={() => setIsDescriptionEditable(true)}
                onDescriptionUpdate={onDescriptionUpdate}
              />
              <GlossaryTermTab
                isGlossary
                childGlossaryTerms={glossaryTerms}
                permissions={permissions}
                refreshGlossaryTerms={refreshGlossaryTerms}
                selectedData={glossary}
                termsLoading={termsLoading}
                onAddGlossaryTerm={onAddGlossaryTerm}
                onEditGlossaryTerm={onEditGlossaryTerm}
              />
            </Space>
          </Col>
          <Col span={6}>
            <GlossaryDetailsRightPanel
              isGlossary
              isVersionView={isVersionView}
              permissions={permissions}
              selectedData={glossary}
              onUpdate={updateGlossary}
            />
          </Col>
        </Row>
      </Col>
    </Row>
  );
};

export default GlossaryDetails;
